const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const redis = require('../config/redis');
const env = require('../config/env');
const { transporter, from } = require('../config/mailer');
const { generateOtp, hashOtp, safeEqual, randomToken, sha256 } = require('../utils/crypto');
const { badRequest, unauthorized, tooMany, conflict, AppError } = require('../utils/errors');

// Fixed hash so login takes the same time whether or not the user exists (prevents user enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.bcryptRounds);
const GENERIC = { message: 'If this address is eligible, a 6-digit code is on its way. It expires in ' + env.otpTtlMin + ' minutes.' };

async function sendOtpMail(to, otp) {
  await transporter.sendMail({
    from: `CampusConnect <${from}>`, to, subject: `${otp} is your CampusConnect verification code`,
    text: `Your CampusConnect code is ${otp}. It expires in ${env.otpTtlMin} minutes. If you did not request it, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto"><h2 style="margin:0 0 8px">CampusConnect</h2>
      <p>Use this code to verify your Bennett University email:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:700;background:#f1f3f8;padding:14px 18px;border-radius:8px;text-align:center">${otp}</p>
      <p style="color:#555">It expires in ${env.otpTtlMin} minutes. If you did not request this, you can ignore this email.</p></div>`,
  });
}

async function requestOtp({ email, purpose }, ip) {
  const cd = await redis.set(`otp:cd:${email}`, '1', 'EX', env.otpResendCooldownSec, 'NX');
  if (!cd) throw tooMany(`Please wait ${env.otpResendCooldownSec} seconds before requesting another code.`);
  const n = await redis.incr(`otp:hr:${email}`);
  if (n === 1) await redis.expire(`otp:hr:${email}`, 3600);
  if (n > env.otpMaxPerHour) throw tooMany('Too many codes requested. Try again in an hour.');

  const user = await prisma.user.findUnique({ where: { email } });
  if ((purpose === 'REGISTER' && user) || (purpose === 'RESET' && !user)) return GENERIC; // no account enumeration

  const otp = generateOtp();
  await prisma.$transaction([
    prisma.otpChallenge.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    prisma.otpChallenge.create({ data: { email, purpose, otpHash: hashOtp(email, otp), expiresAt: new Date(Date.now() + env.otpTtlMin * 60_000), ip } }),
  ]);
  try { await sendOtpMail(email, otp); }
  catch (e) {
    console.error('[otp-mail]', e.message);
    await redis.del(`otp:cd:${email}`);
    throw new AppError(502, 'We could not send the email right now. Please try again in a minute.');
  }
  return GENERIC;
}

async function verifyOtp({ email, otp, purpose }) {
  const ch = await prisma.otpChallenge.findFirst({ where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!ch) throw badRequest('This code has expired. Request a new one.', 'OTP_EXPIRED');
  if (ch.attempts >= ch.maxAttempts) throw tooMany('Too many wrong attempts. Request a new code.');
  const ok = safeEqual(ch.otpHash, hashOtp(email, otp));
  if (!ok) {
    await prisma.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    throw badRequest('That code is not correct.', 'OTP_INVALID');
  }
  const claimed = await prisma.otpChallenge.updateMany({ where: { id: ch.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (claimed.count !== 1) throw badRequest('This code was already used.', 'OTP_USED');
  const token = randomToken(32);
  await prisma.verifiedRegistrationChallenge.create({ data: { email, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 15 * 60_000) } });
  return { registrationToken: token };
}

async function issueSession(user, meta) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwtAccessSecret, { algorithm: 'HS256', expiresIn: env.jwtAccessTtl });
  const refreshToken = randomToken(48);
  await prisma.userSession.create({ data: { userId: user.id, refreshTokenHash: sha256(refreshToken), userAgent: meta.ua?.slice(0, 250), ip: meta.ip, expiresAt: new Date(Date.now() + env.refreshTtlDays * 86_400_000) } });
  return { accessToken, refreshToken, user: publicUser(user) };
}
const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

async function setPassword({ registrationToken, password, name }, meta) {
  const ch = await prisma.verifiedRegistrationChallenge.findUnique({ where: { tokenHash: sha256(registrationToken) } });
  if (!ch || ch.usedAt || ch.expiresAt < new Date()) throw badRequest('Your verification expired. Start again.', 'REG_EXPIRED');
  const claimed = await prisma.verifiedRegistrationChallenge.updateMany({ where: { id: ch.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) throw badRequest('Your verification was already used.', 'REG_USED');

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  let user;
  if (ch.purpose === 'REGISTER') {
    if (await prisma.user.findUnique({ where: { email: ch.email } })) throw conflict('An account with this email already exists. Sign in instead.');
    user = await prisma.user.create({ data: { email: ch.email, passwordHash, name: name || null, emailVerified: true, role: env.adminEmails.includes(ch.email) ? 'ADMIN' : 'STUDENT' } });
  } else {
    user = await prisma.user.update({ where: { email: ch.email }, data: { passwordHash, emailVerified: true } });
    await prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return issueSession(user, meta);
}

async function login({ email, password }, meta) {
  const lockKey = `login:fail:${email}`;
  if (Number(await redis.get(lockKey)) >= 5) throw tooMany('Too many failed attempts. Try again in 15 minutes.');
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    const n = await redis.incr(lockKey); if (n === 1) await redis.expire(lockKey, 900);
    throw unauthorized('Email or password is incorrect.');
  }
  if (user.status !== 'ACTIVE') throw unauthorized('This account is suspended. Contact the administrator.');
  await redis.del(lockKey);
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  return issueSession(user, meta);
}

async function refresh({ refreshToken }, meta) {
  const s = await prisma.userSession.findUnique({ where: { refreshTokenHash: sha256(refreshToken) }, include: { user: true } });
  if (!s) throw unauthorized('Session invalid');
  if (s.revokedAt) { // a rotated token was replayed: assume theft, kill every session
    await prisma.userSession.updateMany({ where: { userId: s.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized('Session invalid');
  }
  if (s.expiresAt < new Date() || s.user.status !== 'ACTIVE') throw unauthorized('Session expired');
  await prisma.userSession.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
  return issueSession(s.user, meta);
}

async function logout({ refreshToken }) {
  await prisma.userSession.updateMany({ where: { refreshTokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
}

module.exports = { requestOtp, verifyOtp, setPassword, login, refresh, logout, publicUser };
