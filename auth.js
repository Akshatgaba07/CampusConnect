const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { unauthorized, forbidden } = require('../utils/errors');
const authenticate = (req, _res, next) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return next(unauthorized());
  try { req.user = jwt.verify(h.slice(7), env.jwtAccessSecret, { algorithms: ['HS256'] }); next(); }
  catch { next(unauthorized('Session expired')); }
};
const requireRole = (role) => (req, _res, next) => (req.user?.role === role ? next() : next(forbidden('Admin access required')));
module.exports = { authenticate, requireRole };
