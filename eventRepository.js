const prisma = require('../config/db');
const slotSelect = { id: true, startsAt: true, endsAt: true, capacity: true, confirmedCount: true, mode: true, maxSeatsPerBooking: true };
module.exports = {
  listPublished: () => prisma.event.findMany({
    where: { status: 'PUBLISHED', registrationCloses: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }, include: { slots: { select: slotSelect, orderBy: { startsAt: 'asc' } } },
  }),
  findPublished: (id) => prisma.event.findFirst({ where: { id, status: 'PUBLISHED' }, include: { slots: { select: slotSelect, orderBy: { startsAt: 'asc' } } } }),
  findAny: (id) => prisma.event.findUnique({ where: { id }, include: { slots: { select: slotSelect, orderBy: { startsAt: 'asc' } } } }),
  listAll: () => prisma.event.findMany({ orderBy: { createdAt: 'desc' }, include: { slots: { select: slotSelect, orderBy: { startsAt: 'asc' } } } }),
  seatsForSlot: (slotId) => prisma.seat.findMany({ where: { slotId }, select: { id: true, label: true, status: true }, orderBy: [{ label: 'asc' }] }),
};
