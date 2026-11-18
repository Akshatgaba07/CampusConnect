const svc = require('../services/authService');
const prisma = require('../config/db');
const h = require('../utils/asyncHandler');
const meta = (req) => ({ ip: req.ip, ua: req.headers['user-agent'] });
module.exports = {
  requestOtp: h(async (req, res) => res.json(await svc.requestOtp(req.body, req.ip))),
  verifyOtp: h(async (req, res) => res.json(await svc.verifyOtp(req.body))),
  setPassword: h(async (req, res) => res.status(201).json(await svc.setPassword(req.body, meta(req)))),
  login: h(async (req, res) => res.json(await svc.login(req.body, meta(req)))),
  refresh: h(async (req, res) => res.json(await svc.refresh(req.body, meta(req)))),
  logout: h(async (req, res) => { await svc.logout(req.body); res.status(204).end(); }),
  me: h(async (req, res) => res.json({ user: svc.publicUser(await prisma.user.findUnique({ where: { id: req.user.sub } })) })),
};
