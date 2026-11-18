const svc = require('../services/adminService');
const repo = require('../repositories/eventRepository');
const h = require('../utils/asyncHandler');
const audit = require('../utils/audit');
const { notFound, badRequest } = require('../utils/errors');
module.exports = {
  listEvents: h(async (_req, res) => res.json({ events: await repo.listAll() })),
  getEvent: h(async (req, res) => { const e = await repo.findAny(req.params.id); if (!e) throw notFound('Event not found'); res.json({ event: e }); }),
  createEvent: h(async (req, res) => { const e = await svc.createEvent(req.user, req.body); await audit(req, 'EVENT_CREATED', 'Event', e.id, { title: e.title }); res.status(201).json({ event: e }); }),
  updateEvent: h(async (req, res) => { const e = await svc.updateEvent(req.params.id, req.body); await audit(req, 'EVENT_UPDATED', 'Event', e.id); res.json({ event: e }); }),
  publish: h(async (req, res) => { const e = await svc.setStatus(req.params.id, 'PUBLISHED'); await audit(req, 'EVENT_PUBLISHED', 'Event', e.id); res.json({ event: e }); }),
  complete: h(async (req, res) => { const e = await svc.setStatus(req.params.id, 'COMPLETED'); await audit(req, 'EVENT_COMPLETED', 'Event', e.id); res.json({ event: e }); }),
  cancelEvent: h(async (req, res) => { const r = await svc.cancelEvent(req.params.id); await audit(req, 'EVENT_CANCELLED', 'Event', req.params.id, r); res.json(r); }),
  addSlot: h(async (req, res) => { const s = await svc.addSlot(req.params.id, req.body); await audit(req, 'SLOT_ADDED', 'EventSlot', s.id, { capacity: s.capacity }); res.status(201).json({ slot: s }); }),
  deleteSlot: h(async (req, res) => { await svc.deleteSlot(req.params.slotId); await audit(req, 'SLOT_DELETED', 'EventSlot', req.params.slotId); res.status(204).end(); }),
  attendees: h(async (req, res) => res.json({ attendees: await svc.attendees(req.params.id) })),
  analytics: h(async (_req, res) => res.json(await svc.analytics())),
  auditLogs: h(async (_req, res) => res.json({ logs: await svc.auditLogs() })),
  users: h(async (_req, res) => res.json({ users: await svc.users() })),
  setUserStatus: h(async (req, res) => {
    if (!['ACTIVE', 'SUSPENDED'].includes(req.body?.status)) throw badRequest('Invalid status');
    if (req.params.id === req.user.sub) throw badRequest('You cannot change your own status.');
    const r = await svc.setUserStatus(req.params.id, req.body.status); await audit(req, 'USER_STATUS_CHANGED', 'User', req.params.id, r); res.json(r);
  }),
  verify: h(async (req, res) => res.json(await svc.verifyTicket(req.body.qr))),
  checkIn: h(async (req, res) => { const r = await svc.checkIn(req.body.qr, req.user.email); if (r.result === 'ADMITTED') await audit(req, 'TICKET_CHECKED_IN', 'Ticket', r.ticketId); res.json(r); }),
};
