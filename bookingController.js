const svc = require('../services/bookingService');
const h = require('../utils/asyncHandler');
module.exports = {
  hold: h(async (req, res) => res.status(201).json({ booking: await svc.holdSeats(req.user, req.body) })),
  confirm: h(async (req, res) => res.json({ booking: await svc.confirm(req.user, req.params.id) })),
  cancel: h(async (req, res) => res.json({ booking: await svc.cancel(req.user, req.params.id) })),
  mine: h(async (req, res) => res.json({ bookings: await svc.mine(req.user) })),
};
