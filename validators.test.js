process.env.DATABASE_URL = 'x'; process.env.JWT_ACCESS_SECRET = 'x'; process.env.TICKET_HMAC_SECRET = 'ticket-secret'; process.env.OTP_PEPPER = 'pepper'; process.env.INTERNAL_API_KEY = 'k';
const test = require('node:test');
const assert = require('node:assert');
const { isBennettEmail, schemas } = require('../src/utils/validators');
const { generateOtp, hashOtp } = require('../src/utils/crypto');
const { qrPayload, tokenFor, hashToken } = require('../src/utils/ticketToken');

test('accepts only @bennett.edu.in addresses', () => {
  assert.ok(isBennettEmail('s24cseu1608@bennett.edu.in'));
  assert.ok(isBennettEmail('  S24CSEU1608@Bennett.edu.in '));
  for (const bad of ['a@gmail.com', 'a@bennett.edu.in.evil.com', 'a@evil.com?@bennett.edu.in', 'a@sub.bennett.edu.in', '@bennett.edu.in', 'a b@bennett.edu.in'])
    assert.equal(isBennettEmail(bad), false, bad);
});
test('password policy', () => {
  assert.ok(schemas.setPassword.safeParse({ registrationToken: 'x'.repeat(30), password: 'Str0ng!Passw0rd' }).success);
  assert.equal(schemas.setPassword.safeParse({ registrationToken: 'x'.repeat(30), password: 'weakpass' }).success, false);
});
test('otp is 6 digits and hash is email-bound', () => {
  assert.match(generateOtp(), /^\d{6}$/);
  assert.notEqual(hashOtp('a@bennett.edu.in', '123456'), hashOtp('b@bennett.edu.in', '123456'));
});
test('qr payload is stable and verifiable by hash', () => {
  const id = '11111111-1111-1111-1111-111111111111';
  const [v, tid, tok] = qrPayload(id).split('.');
  assert.equal(v, 'CC1'); assert.equal(tid, id); assert.equal(tok, tokenFor(id));
  assert.equal(hashToken(tok), hashToken(tokenFor(id)));
});
