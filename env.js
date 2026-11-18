const must = (k) => { if (!process.env[k]) throw new Error(`Missing env var ${k}`); return process.env[k]; };
const num = (k, d) => (process.env[k] ? Number(process.env[k]) : d);

module.exports = {
  port: num('PORT', 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: must('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
  jwtAccessSecret: must('JWT_ACCESS_SECRET'),
  jwtAccessTtl: process.env.JWT_ACCESS_TTL || '15m',
  refreshTtlDays: num('REFRESH_TTL_DAYS', 7),
  ticketSecret: must('TICKET_HMAC_SECRET'),
  otpPepper: must('OTP_PEPPER'),
  emailDomain: '@bennett.edu.in',
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  otpTtlMin: num('OTP_TTL_MINUTES', 10),
  otpResendCooldownSec: num('OTP_RESEND_COOLDOWN_SEC', 60),
  otpMaxPerHour: num('OTP_MAX_PER_HOUR', 5),
  holdTtlSec: num('SEAT_HOLD_TTL_SEC', 300),
  bcryptRounds: num('BCRYPT_ROUNDS', 12),
  qrServiceUrl: process.env.QR_SERVICE_URL || 'http://localhost:8081',
  internalApiKey: must('INTERNAL_API_KEY'),
  smtp: {
    host: process.env.SMTP_HOST || 'smtp-mail.outlook.com',
    port: num('SMTP_PORT', 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
  },
};
