const crypto = require('crypto');
const prisma = require('../config/db');
const redis = require('../config/redis');
const env = require('../config/env');
const { emitSeats } = require('../config/socket');
const repo = require('../repositories/bookingRepository');
const { badRequest, conflict, notFound } = require('../utils/errors');
const { qrPayload, hashToken, tokenFor } = require('../utils/ticketToken');

const lockKey = (seatId) => `lock:seat:${seatId}`;
// Delete the lock only if we still own it (compare-and-delete is atomic inside Lua).
const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
async function releaseLocks(seatIds, owner) { await Promise.all(seatIds.map((id) => redis.eval(RELEASE, 1, lockKey(id), owner).catch(() => {}))); }

// Serialise booking -> client shape (adds the QR payload only for confirmed tickets the caller owns)
function present(b) {
  return {
    id: b.id, status: b.status, quantity: b.quantity, holdExpiresAt: b.holdExpiresAt, createdAt: b.createdAt, confirmedAt: b.confirmedAt,
    event: { id: b.slot.event.id, title: b.slot.event.title, venue: b.slot.event.venue, organizer: b.slot.event.organizer, speaker: b.slot.event.speaker, posterUrl: b.slot.event.posterUrl },
    slot: { id: b.slot.id, startsAt: b.slot.startsAt, endsAt: b.slot.endsAt, mode: b.slot.mode },
    seats: b.seats.map((bs) => ({ id: bs.seat.id, label: bs.seat.label, ticket: bs.ticket ? { id: bs.ticket.id, qr: b.status === 'CONFIRMED' ? qrPayload(bs.ticket.id) : null, checkedInAt: bs.ticket.checkedInAt } : null })),
  };
}

async function holdSeats(user, { slotId, seatIds, idempotencyKey }) {
  const existing = await repo.findByIdempotency(user.sub, idempotencyKey);
  if (existing) return present(existing); // same click replayed -> same answer, no second hold

  const ids = [...new Set(seatIds)];
  const slot = await prisma.eventSlot.findUnique({ where: { id: slotId }, include: { event: true } });
  const now = new Date();
  if (!slot || slot.event.status !== 'PUBLISHED') throw notFound('This slot is not available.');
  if (now < slot.event.registrationOpens) throw badRequest('Registration has not opened yet.');
  if (now > slot.event.registrationCloses || now >= slot.startsAt) throw badRequest('Registration for this slot has closed.');
  if (ids.length > slot.maxSeatsPerBooking) throw badRequest(`You can book at most ${slot.maxSeatsPerBooking} seat(s) per slot.`);
  const live = await prisma.booking.findFirst({ where: { userId: user.sub, slotId, status: { in: ['PENDING', 'CONFIRMED'] } } });
  if (live) throw conflict('You already have a booking for this slot.', 'ALREADY_BOOKED');
  const found = await prisma.seat.count({ where: { id: { in: ids }, slotId } });
  if (found !== ids.length) throw badRequest('One or more seats do not belong to this slot.');

  const bookingId = crypto.randomUUID();
  // 1) Fast gate: Redis SET NX. Only one request can own a seat key; losers fail instantly without touching Postgres.
  const acquired = [];
  for (const id of ids) {
    const ok = await redis.set(lockKey(id), bookingId, 'EX', env.holdTtlSec + 30, 'NX');
    if (!ok) { await releaseLocks(acquired, bookingId); throw conflict('Someone just took one of those seats. Pick another.', 'SEAT_TAKEN'); }
    acquired.push(id);
  }
  // 2) Source of truth: Postgres transaction with conditional UPDATEs + seat_allocations PK (second and third safety net).
  try {
    await prisma.$transaction(async (tx) => {
      await tx.booking.create({ data: { id: bookingId, userId: user.sub, slotId, status: 'PENDING', quantity: ids.length, idempotencyKey, holdExpiresAt: new Date(Date.now() + env.holdTtlSec * 1000) } });
      for (const seatId of ids) {
        const r = await tx.seat.updateMany({ where: { id: seatId, status: 'AVAILABLE' }, data: { status: 'HELD', version: { increment: 1 } } });
        if (r.count !== 1) throw conflict('Someone just took one of those seats. Pick another.', 'SEAT_TAKEN');
        await tx.$executeRaw`INSERT INTO seat_allocations (seat_id, booking_id) VALUES (${seatId}::uuid, ${bookingId}::uuid)`;
        await tx.bookingSeat.create({ data: { bookingId, seatId } });
      }
    });
  } catch (e) {
    await releaseLocks(ids, bookingId);
    if (e.status) throw e;
    if (String(e.message).includes('seat_allocations') || e.code === 'P2010' || e.code === 'P2002') throw conflict('Someone just took one of those seats. Pick another.', 'SEAT_TAKEN');
    throw e;
  }
  emitSeats(slotId, ids, 'HELD');
  return present(await repo.findForUser(bookingId, user.sub));
}

async function confirm(user, bookingId) {
  const { booking, seatIds } = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId, userId: user.sub }, include: { seats: true, slot: { include: { event: true } } } });
    if (!b) throw notFound('Booking not found.');
    if (b.status === 'CONFIRMED') return { booking: b, seatIds: [], already: true };
    const claimed = await tx.booking.updateMany({ where: { id: b.id, status: 'PENDING', holdExpiresAt: { gt: new Date() } }, data: { status: 'CONFIRMED', confirmedAt: new Date(), holdExpiresAt: null } });
    if (claimed.count !== 1) throw conflict('Your hold expired. Please pick your seats again.', 'HOLD_EXPIRED');
    const n = b.seats.length;
    const cap = await tx.$executeRaw`UPDATE event_slots SET confirmed_count = confirmed_count + ${n} WHERE id = ${b.slotId}::uuid AND confirmed_count + ${n} <= capacity`;
    if (cap !== 1) throw conflict('This slot is full.', 'SLOT_FULL');
    const seatIds = b.seats.map((s) => s.seatId);
    await tx.seat.updateMany({ where: { id: { in: seatIds }, status: 'HELD' }, data: { status: 'BOOKED', version: { increment: 1 } } });
    const tickets = [];
    for (const bs of b.seats) {
      const ticketId = crypto.randomUUID();
      await tx.ticket.create({ data: { id: ticketId, bookingId: b.id, bookingSeatId: bs.id, tokenHash: hashToken(tokenFor(ticketId)) } });
      tickets.push({ ticketId, seatId: bs.seatId });
    }
    const seats = await tx.seat.findMany({ where: { id: { in: seatIds } } });
    const label = Object.fromEntries(seats.map((s) => [s.id, s.label]));
    const u = await tx.user.findUnique({ where: { id: user.sub } });
    const payload = { to: u.email, name: u.name, bookingId: b.id, event: { title: b.slot.event.title, venue: b.slot.event.venue, speaker: b.slot.event.speaker, organizer: b.slot.event.organizer }, slot: { startsAt: b.slot.startsAt, endsAt: b.slot.endsAt, mode: b.slot.mode }, tickets: tickets.map((t) => ({ seat: label[t.seatId], qr: qrPayload(t.ticketId) })) };
    const notif = await tx.notification.create({ data: { userId: user.sub, type: 'BOOKING_CONFIRMED', payload } });
    await tx.outboxEvent.create({ data: { topic: 'notifications', key: b.id, payload: { notificationId: notif.id, type: 'BOOKING_CONFIRMED', ...payload } } });
    return { booking: b, seatIds };
  });
  if (seatIds.length) { await releaseLocks(seatIds, bookingId); emitSeats(booking.slotId, seatIds, 'BOOKED'); }
  return present(await repo.findForUser(bookingId, user.sub));
}

// Shared by cancel() and the hold-expiry job: frees seats everywhere (DB, allocations, Redis, sockets).
async function releaseBooking(bookingId, newStatus, onlyUserId) {
  const result = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.findFirst({ where: { id: bookingId, ...(onlyUserId ? { userId: onlyUserId } : {}) }, include: { seats: true, slot: { include: { event: true } } } });
    if (!b) return null;
    const wasConfirmed = b.status === 'CONFIRMED';
    const claimed = await tx.booking.updateMany({ where: { id: b.id, status: { in: wasConfirmed ? ['CONFIRMED'] : ['PENDING'] } }, data: { status: newStatus, cancelledAt: new Date(), holdExpiresAt: null } });
    if (claimed.count !== 1) return { b, changed: false };
    const seatIds = b.seats.map((s) => s.seatId);
    await tx.seat.updateMany({ where: { id: { in: seatIds } }, data: { status: 'AVAILABLE', version: { increment: 1 } } });
    await tx.$executeRaw`DELETE FROM seat_allocations WHERE booking_id = ${b.id}::uuid`;
    if (wasConfirmed) {
      await tx.eventSlot.update({ where: { id: b.slotId }, data: { confirmedCount: { decrement: seatIds.length } } });
      await tx.ticket.deleteMany({ where: { bookingId: b.id } }); // revokes the QR immediately
      const u = await tx.user.findUnique({ where: { id: b.userId } });
      const payload = { to: u.email, name: u.name, bookingId: b.id, event: { title: b.slot.event.title }, slot: { startsAt: b.slot.startsAt } };
      const notif = await tx.notification.create({ data: { userId: b.userId, type: 'BOOKING_CANCELLED', payload } });
      await tx.outboxEvent.create({ data: { topic: 'notifications', key: b.id, payload: { notificationId: notif.id, type: 'BOOKING_CANCELLED', ...payload } } });
    }
    return { b, changed: true, seatIds };
  });
  if (result?.changed) { await releaseLocks(result.seatIds, bookingId); emitSeats(result.b.slotId, result.seatIds, 'AVAILABLE'); }
  return result;
}

async function cancel(user, bookingId) {
  const b = await repo.findForUser(bookingId, user.sub);
  if (!b) throw notFound('Booking not found.');
  if (!['PENDING', 'CONFIRMED'].includes(b.status)) throw conflict('This booking is already closed.');
  if (b.status === 'CONFIRMED' && b.slot.startsAt.getTime() - Date.now() < 3_600_000) throw badRequest('Confirmed bookings cannot be cancelled within 1 hour of the start.');
  await releaseBooking(bookingId, 'CANCELLED', user.sub);
  return present(await repo.findForUser(bookingId, user.sub));
}

async function expireHolds() {
  const stale = await prisma.booking.findMany({ where: { status: 'PENDING', holdExpiresAt: { lt: new Date() } }, take: 100, select: { id: true } });
  for (const { id } of stale) { try { await releaseBooking(id, 'EXPIRED'); } catch (e) { console.error('[expire]', id, e.message); } }
  return stale.length;
}

const mine = async (user) => (await repo.mine(user.sub)).map(present);
module.exports = { holdSeats, confirm, cancel, expireHolds, mine, present };
