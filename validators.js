const { z } = require('zod');
const DOMAIN = '@bennett.edu.in';
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const isBennettEmail = (e) => /^[a-z0-9._%+-]+@bennett\.edu\.in$/.test(normalizeEmail(e));
const email = z.string().transform(normalizeEmail).refine(isBennettEmail, 'Only @bennett.edu.in email addresses are allowed');
const password = z.string().min(10, 'Password needs at least 10 characters').max(72, 'Password can be at most 72 characters')
  .regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter')
  .regex(/[0-9]/, 'Add a number').regex(/[^A-Za-z0-9]/, 'Add a symbol');
const uuid = z.string().uuid();
const schemas = {
  requestOtp: z.object({ email, purpose: z.enum(['REGISTER', 'RESET']).default('REGISTER') }),
  verifyOtp: z.object({ email, otp: z.string().regex(/^\d{6}$/, 'OTP is 6 digits'), purpose: z.enum(['REGISTER', 'RESET']).default('REGISTER') }),
  setPassword: z.object({ registrationToken: z.string().min(20), password, name: z.string().trim().min(2).max(80).optional() }),
  login: z.object({ email, password: z.string().min(1).max(72) }),
  refresh: z.object({ refreshToken: z.string().min(20) }),
  hold: z.object({ slotId: uuid, seatIds: z.array(uuid).min(1).max(10), idempotencyKey: z.string().min(8).max(100) }),
  event: z.object({
    title: z.string().trim().min(3).max(150), description: z.string().trim().min(10).max(5000), category: z.string().trim().min(2).max(50),
    venue: z.string().trim().min(2).max(150), posterUrl: z.string().url().max(500).optional().or(z.literal('')).transform((v) => v || null),
    speaker: z.string().trim().max(120).optional().nullable(), organizer: z.string().trim().min(2).max(120),
    registrationOpens: z.coerce.date(), registrationCloses: z.coerce.date(),
  }),
  slot: z.object({
    startsAt: z.coerce.date(), endsAt: z.coerce.date(), capacity: z.number().int().min(1).max(260),
    mode: z.enum(['OFFLINE', 'ONLINE', 'HYBRID']).default('OFFLINE'), maxSeatsPerBooking: z.number().int().min(1).max(10).default(2),
  }),
  checkin: z.object({ qr: z.string().min(10).max(500) }),
};
module.exports = { schemas, isBennettEmail, normalizeEmail, DOMAIN };
