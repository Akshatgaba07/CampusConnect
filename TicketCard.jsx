import { QRCodeSVG } from 'qrcode.react';
import { CalendarClock, MapPin, Mic } from 'lucide-react';
import { fmtFull, fmtTime } from '../lib/format.js';

// One card per seat. The QR carries only the signed ticket reference; details are looked up live at the gate.
export default function TicketCard({ booking, seat }) {
  const { event, slot } = booking;
  return (
    <article className="stub grid overflow-hidden sm:grid-cols-[1fr_auto]">
      <div className="p-5">
        <div className="font-display text-xl font-bold leading-tight">{event.title}</div>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-600">
          <li className="flex gap-2"><CalendarClock size={16} className="mt-0.5 shrink-0" />{fmtFull(slot.startsAt)} to {fmtTime(slot.endsAt)}</li>
          <li className="flex gap-2"><MapPin size={16} className="mt-0.5 shrink-0" />{event.venue} · {slot.mode.toLowerCase()}</li>
          {event.speaker && <li className="flex gap-2"><Mic size={16} className="mt-0.5 shrink-0" />{event.speaker}</li>}
        </ul>
        <div className="mt-4 flex items-end gap-3"><div><div className="text-xs text-ink-400">Seat</div><div className="font-display text-4xl font-bold leading-none">{seat.label}</div></div>
          {seat.ticket?.checkedInAt && <span className="chip mb-1 bg-ink-100 text-ink-600">Checked in</span>}</div>
      </div>
      <div className="flex flex-col items-center justify-center border-t border-dashed border-ink-200 p-5 sm:border-l sm:border-t-0">
        {seat.ticket?.qr ? <QRCodeSVG value={seat.ticket.qr} size={132} level="M" /> : <div className="text-sm text-ink-400">No QR</div>}
        <div className="mt-2 text-[11px] text-ink-400">Show at entrance</div>
      </div>
    </article>
  );
}
