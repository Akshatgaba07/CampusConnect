const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const limits = require('../middleware/rateLimit');
const validate = require('../utils/validate');
const { schemas } = require('../utils/validators');
const auth = require('../controllers/authController');
const events = require('../controllers/eventController');
const bookings = require('../controllers/bookingController');
const admin = require('../controllers/adminController');

router.get('/health', (_req, res) => res.json({ ok: true }));

// --- auth (public) ---
router.post('/auth/request-otp', limits.auth, validate(schemas.requestOtp), auth.requestOtp);
router.post('/auth/verify-otp', limits.auth, validate(schemas.verifyOtp), auth.verifyOtp);
router.post('/auth/set-password', limits.auth, validate(schemas.setPassword), auth.setPassword);
router.post('/auth/login', limits.auth, validate(schemas.login), auth.login);
router.post('/auth/refresh', limits.auth, validate(schemas.refresh), auth.refresh);
router.post('/auth/logout', validate(schemas.refresh), auth.logout);
router.get('/auth/me', authenticate, auth.me);

// --- student side (any signed-in user) ---
router.get('/events', authenticate, events.list);
router.get('/events/:id', authenticate, events.get);
router.get('/slots/:slotId/seats', authenticate, events.seats);
router.post('/bookings/hold', authenticate, limits.booking, validate(schemas.hold), bookings.hold);
router.post('/bookings/:id/confirm', authenticate, limits.booking, bookings.confirm);
router.post('/bookings/:id/cancel', authenticate, limits.booking, bookings.cancel);
router.get('/bookings/mine', authenticate, bookings.mine);

// --- admin side ---
const a = require('express').Router();
a.use(authenticate, requireRole('ADMIN'));
a.get('/analytics', admin.analytics);
a.get('/events', admin.listEvents);
a.post('/events', validate(schemas.event), admin.createEvent);
a.get('/events/:id', admin.getEvent);
a.put('/events/:id', validate(schemas.event), admin.updateEvent);
a.post('/events/:id/publish', admin.publish);
a.post('/events/:id/complete', admin.complete);
a.post('/events/:id/cancel', admin.cancelEvent);
a.post('/events/:id/slots', validate(schemas.slot), admin.addSlot);
a.delete('/slots/:slotId', admin.deleteSlot);
a.get('/events/:id/attendees', admin.attendees);
a.post('/tickets/verify', validate(schemas.checkin), admin.verify);
a.post('/tickets/check-in', validate(schemas.checkin), admin.checkIn);
a.get('/users', admin.users);
a.patch('/users/:id/status', admin.setUserStatus);
a.get('/audit-logs', admin.auditLogs);
router.use('/admin', a);

module.exports = router;
