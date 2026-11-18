const test = require('node:test');
const assert = require('node:assert');
const { render } = require('../src/templates');
test('confirmation email escapes HTML and has one QR per ticket', () => {
  const r = render.BOOKING_CONFIRMED({ name: '<b>x</b>', event: { title: 'AI Summit', venue: 'Auditorium', speaker: null }, slot: { startsAt: '2026-12-01T09:00:00Z', mode: 'OFFLINE' }, tickets: [{ seat: 'A1', qr: 'q1' }, { seat: 'A2', qr: 'q2' }] });
  assert.ok(!r.html.includes('<b>x</b>'));
  assert.equal((r.html.match(/cid:qr/g) || []).length, 2);
  assert.match(r.subject, /AI Summit/);
});
