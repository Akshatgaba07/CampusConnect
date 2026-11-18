const rateLimit = require('express-rate-limit');
const mk = (windowMs, limit) => rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Slow down and try again shortly.' } });
module.exports = { general: mk(60_000, 300), auth: mk(15 * 60_000, 30), booking: mk(60_000, 30) };
