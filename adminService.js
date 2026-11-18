const prisma = require('../config/db');
const env = require('../config/env');
const repo = require('../repositories/eventRepository');
const { badRequest, notFound, conflict, AppError } = require('../utils/errors');
const { emitSeats } = require('../config/socket');

const seatLabel = (i) => `${String.fromCharCode(65 + Math.floor(i / 10))}${(i % 10) + 1}`; // A1..A10, B1..B10 ... (max 260 seats)

function checkWindow(d) { if (d.registrationCloses <= d.registrationOpens) throw badRequest('Registration must close after it opens.'); }

async function createEvent(user, data) { checkWindow(data); return prisma.event.create({ data: { ...data, createdBy: user.sub } }); }
async function updateEvent(id, data) {
  checkWindow(data);
  try { return await prisma.event.update({ where: { id }, data }); } catch (e) { if (e.code === 'P2025') throw notFound('Event not found'); throw e; }
}
async function setStatus(id, status) {
  const ev = await repo.findAny(id); if (!ev) throw notFound('Event not found');
  if (status === 'PUBLISHED' && ev.slots.length === 0) throw badRequest('Add at least one slot before publishing.');
  return prisma.event.update({ where: { id }, data: { status } });
}
async function addSlot(eventId, d) {
  if (d.endsAt <= d.startsAt) throw badRequest('Slot must end after it starts.');
  const ev = await prisma.event.findUnique({ where: { id: eventId } }); if (!ev) throw notFound('Event not found');
  return prisma.$transaction(async (tx) => {
    const slot = await tx.eventSlot.create({ data: { eventId, ...d } });
    await tx.seat.createMany({ data: Array.from({ length: d.capacity }, (_, i) => ({ slotId: slot.id, label: seatLabel(i) })) });
    return slot;
  });
}
async function deleteSlot(slotId) {
  const n = await prisma.booking.count({ where: { slotId, status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (n > 0) throw conflict('This slot has active bookings. Cancel the event instead.');
  await prisma.$transaction([prisma.booking.deleteMany({ where: { slotId } }), prisma.eventSlot.delete({ where: { id: slotId } })]);
}
async function cancelEvent(eventId) {
  const ev = await repo.findAny(eventId); if (!ev) throw notFound('Event not found');
  await prisma.event.update({ where: { id: eventId }, data: { status: 'CANCELLED' } });
  const bookings = await prisma.booking.findMany({ where: { slot: { eventId }, status: 'CONFIRMED' }, include: { user: true } });
  for (const b of bookings) { // tell every attendee through the same outbox -> Kafka path
    const payload = { to: b.user.email, name: b.user.name, bookingId: b.id, event: { title: ev.title }, slot: { startsAt: ev.slots[0]?.startsAt } };
    await prisma.$transaction(async (tx) => {
      const n = await tx.notification.create({ data: { userId: b.userId, type: 'EVENT_CANCELLED', payload } });
      await tx.outboxEvent.create({ data: { topic: 'notifications', key: b.id, payload: { notificationId: n.id, type: 'EVENT_CANCELLED', ...payload } } });
    });
  }
  return { notified: bookings.length };
}
async function attendees(eventId) {
  const rows = await prisma.bookingSeat.findMany({
    where: { booking: { slot: { eventId }, status: 'CONFIRMED' } },
    include: { seat: true, ticket: true, booking: { include: { user: { select: { email: true, name: true } }, slot: true } } },
    orderBy: [{ booking: { slot: { startsAt: 'asc' } } }, { seat: { label: 'asc' } }],
  });
  return rows.map((r) => ({ name: r.booking.user.name, email: r.booking.user.email, seat: r.seat.label, slotStart: r.booking.slot.startsAt, checkedInAt: r.ticket?.checkedInAt || null, bookingId: r.bookingId }));
}
async function analytics() {
  const [users, events, confirmed, checkedIn] = await Promise.all([
    prisma.user.count(), prisma.event.count({ where: { status: 'PUBLISHED' } }),
    prisma.booking.aggregate({ where: { status: 'CONFIRMED' }, _sum: { quantity: true } }),
    prisma.ticket.count({ where: { checkedInAt: { not: null } } }),
  ]);
  const perDay = await prisma.$queryRaw`SELECT to_char(date_trunc('day', created_at), 'DD Mon') AS day, SUM(quantity)::int AS seats FROM bookings WHERE status = 'CONFIRMED' AND created_at > now() - interval '14 days' GROUP BY date_trunc('day', created_at) ORDER BY date_trunc('day', created_at)`;
  const byCategory = await prisma.$queryRaw`SELECT e.category AS name, COALESCE(SUM(s.confirmed_count),0)::int AS value FROM events e LEFT JOIN event_slots s ON s.event_id = e.id GROUP BY e.category ORDER BY value DESC`;
  const fill = await prisma.$queryRaw`SELECT e.title AS name, COALESCE(SUM(s.confirmed_count),0)::int AS booked, COALESCE(SUM(s.capacity),0)::int AS capacity FROM events e LEFT JOIN event_slots s ON s.event_id = e.id WHERE e.status = 'PUBLISHED' GROUP BY e.id ORDER BY e.created_at DESC LIMIT 8`;
  return { totals: { users, publishedEvents: events, seatsBooked: confirmed._sum.quantity || 0, checkedIn }, perDay, byCategory, fill };
}
const auditLogs = (take = 100) => prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take, include: { actor: { select: { email: true } } } });
const users = () => prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 200, select: { id: true, email: true, name: true, role: true, status: true, createdAt: true, lastLogin: true } });
async function setUserStatus(id, status) {
  const u = await prisma.user.update({ where: { id }, data: { status } });
  if (status === 'SUSPENDED') await prisma.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  return { id: u.id, status: u.status };
}

// Check-in is delegated to the Spring Boot qr-service (verifies + atomically marks the ticket used).
async function qrCall(path, body) {
  let res;
  try {
    res = await fetch(`${env.qrServiceUrl}/api/v1/tickets/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Internal-Key': env.internalApiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  } catch { throw new AppError(503, 'Ticket verification service is unreachable.'); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new AppError(503, 'QR service rejected the internal API key. Recreate both backend and qr-service containers so they load the same INTERNAL_API_KEY from .env.');
  }
  if (!res.ok && res.status >= 500) throw new AppError(503, 'Ticket verification service error.');
  return data;
}
const verifyTicket = (qr) => qrCall('verify', { qr });
const checkIn = (qr, scannedBy) => qrCall('check-in', { qr, scannedBy });

module.exports = { createEvent, updateEvent, setStatus, addSlot, deleteSlot, cancelEvent, attendees, analytics, auditLogs, users, setUserStatus, verifyTicket, checkIn };
