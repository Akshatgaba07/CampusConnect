const fmt = (d) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' }).format(new Date(d));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shell = (inner) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1b2333">${inner}<p style="color:#778;font-size:12px;margin-top:24px">CampusConnect · Bennett University</p></div>`;

function bookingConfirmed(p) {
  const tickets = p.tickets.map((t, i) => `<div style="border:1px dashed #9aa5bd;border-radius:10px;padding:14px;margin:12px 0;display:flex;gap:14px;align-items:center">
    <img src="cid:qr${i}" width="140" height="140" alt="QR for seat ${esc(t.seat)}"/>
    <div><div style="font-size:12px;color:#667">Seat</div><div style="font-size:26px;font-weight:700">${esc(t.seat)}</div></div></div>`).join('');
  return {
    subject: `Booking confirmed: ${p.event.title}`,
    html: shell(`<h2 style="margin:0 0 6px">You're in, ${esc(p.name || 'there')}.</h2>
      <p style="margin:0 0 12px"><b>${esc(p.event.title)}</b><br/>${esc(fmt(p.slot.startsAt))}<br/>${esc(p.event.venue)} (${esc(p.slot.mode.toLowerCase())})</p>
      ${p.event.speaker ? `<p style="margin:0 0 12px">Speaker: ${esc(p.event.speaker)}</p>` : ''}
      <p>Show the QR code at the entrance. Each seat has its own code.</p>${tickets}`),
  };
}
const bookingCancelled = (p) => ({ subject: `Booking cancelled: ${p.event.title}`, html: shell(`<h2>Booking cancelled</h2><p>Your booking for <b>${esc(p.event.title)}</b> was cancelled and the seats were released. Its QR codes no longer work.</p>`) });
const eventCancelled = (p) => ({ subject: `Event cancelled: ${p.event.title}`, html: shell(`<h2>${esc(p.event.title)} has been cancelled</h2><p>The organisers cancelled this event. Your tickets are void. We're sorry for the change.</p>`) });

module.exports = { render: { BOOKING_CONFIRMED: bookingConfirmed, BOOKING_CANCELLED: bookingCancelled, EVENT_CANCELLED: eventCancelled }, fmt };
