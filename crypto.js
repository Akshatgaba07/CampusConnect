const crypto = require('crypto');
const env = require('../config/env');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const hmac = (s, secret) => crypto.createHmac('sha256', secret).update(s).digest('hex');
// 6-digit OTP from a CSPRNG (never Math.random)
const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const hashOtp = (email, otp) => hmac(`${email}:${otp}`, env.otpPepper);
const safeEqual = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); };
module.exports = { sha256, randomToken, hmac, generateOtp, hashOtp, safeEqual };
