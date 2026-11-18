const env = require('../config/env');
const { hmac, sha256 } = require('./crypto');
// Deterministic per-ticket secret: lets the owner re-display the QR later while the DB only stores sha256(token).
const tokenFor = (ticketId) => Buffer.from(hmac(ticketId, env.ticketSecret), 'hex').toString('base64url');
const qrPayload = (ticketId) => `CC1.${ticketId}.${tokenFor(ticketId)}`;
const hashToken = (token) => sha256(token);
module.exports = { tokenFor, qrPayload, hashToken };
