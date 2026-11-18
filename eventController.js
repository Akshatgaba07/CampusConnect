const repo = require('../repositories/eventRepository');
const h = require('../utils/asyncHandler');
const { notFound } = require('../utils/errors');
const prisma = require('../config/db');
module.exports = {
  list: h(async (_req, res) => res.json({ events: await repo.listPublished() })),
  get: h(async (req, res) => { const e = await repo.findPublished(req.params.id); if (!e) throw notFound('Event not found'); res.json({ event: e }); }),
  seats: h(async (req, res) => {
    const slot = await prisma.eventSlot.findFirst({ where: { id: req.params.slotId, event: { status: 'PUBLISHED' } } });
    if (!slot) throw notFound('Slot not found');
    res.json({ slot, seats: await repo.seatsForSlot(slot.id) });
  }),
};
