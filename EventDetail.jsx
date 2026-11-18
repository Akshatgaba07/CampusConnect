import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, MapPin, Mic, Timer } from 'lucide-react';
import api, { errCode, errMsg } from '../../lib/api.js';
import { getSocket } from '../../lib/socket.js';
import { fmtFull, fmtTime } from '../../lib/format.js';
import SeatMap from '../../components/SeatMap.jsx';
import { ErrorNote, Spinner } from '../../components/ui.jsx';

function Countdown({ until, onDone }) {
  const [left, setLeft] = useState(Math.max(0, Math.floor((new Date(until) - Date.now()) / 1000)));
  useEffect(() => { const t = setInterval(() => { const s = Math.max(0, Math.floor((new Date(until) - Date.now()) / 1000)); setLeft(s); if (s === 0) { clearInterval(t); onDone(); } }, 500); return () => clearInterval(t); }, [until, onDone]);
  return <span className="tabular-nums">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>;
}

export default function EventDetail() {
  const { id } = useParams(); const nav = useNavigate();
  const [event, setEvent] = useState(null); const [slotId, setSlotId] = useState(null); const [seats, setSeats] = useState([]); const [slotInfo, setSlotInfo] = useState(null);
  const [selected, setSelected] = useState([]); const [hold, setHold] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const idem = useRef(null); // same key for retries of the same attempt -> server returns the same hold

  useEffect(() => { api.get(`/events/${id}`).then((r) => { setEvent(r.data.event); setSlotId(r.data.event.slots[0]?.id || null); }).catch((e) => setErr(errMsg(e))); }, [id]);

  const loadSeats = useCallback(async (sid) => { const r = await api.get(`/slots/${sid}/seats`); setSeats(r.data.seats); setSlotInfo(r.data.slot); }, []);
  useEffect(() => {
    if (!slotId) return; setSelected([]); setHold(null); idem.current = null; setErr('');
    loadSeats(slotId).catch((e) => setErr(errMsg(e)));
    const s = getSocket(); const join = () => s.emit('slot:join', slotId); join(); s.on('connect', join);
    const onUpdate = ({ slotId: sid, seatIds, status }) => { if (sid !== slotId) return; setSeats((cur) => cur.map((x) => (seatIds.includes(x.id) ? { ...x, status } : x))); setSelected((cur) => cur.filter((x) => !(status !== 'AVAILABLE' && seatIds.includes(x)))); };
    s.on('seats:update', onUpdate);
    return () => { s.emit('slot:leave', slotId); s.off('connect', join); s.off('seats:update', onUpdate); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotId, loadSeats]);

  const max = slotInfo?.maxSeatsPerBooking || 1;
  const toggle = (s) => setSelected((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : cur.length >= max ? cur : [...cur, s.id]));
  const labelOf = (sid) => seats.find((s) => s.id === sid)?.label;

  const doHold = async () => {
    setBusy(true); setErr(''); idem.current ||= crypto.randomUUID();
    try { const { data } = await api.post('/bookings/hold', { slotId, seatIds: selected, idempotencyKey: idem.current }); setHold(data.booking); }
    catch (e) { setErr(errMsg(e)); if (['SEAT_TAKEN', 'ALREADY_BOOKED'].includes(errCode(e))) { idem.current = null; setSelected([]); loadSeats(slotId); } }
    finally { setBusy(false); }
  };
  const doConfirm = async () => { setBusy(true); setErr(''); try { await api.post(`/bookings/${hold.id}/confirm`); nav('/tickets'); } catch (e) { setErr(errMsg(e)); if (errCode(e) === 'HOLD_EXPIRED') expired(); } finally { setBusy(false); } };
  const release = async () => { try { await api.post(`/bookings/${hold.id}/cancel`); } catch { /* the expiry job will free it anyway */ } setHold(null); setSelected([]); idem.current = null; loadSeats(slotId); };
  const expired = useCallback(() => { setHold(null); setSelected([]); idem.current = null; setErr('Your 5 minute hold ran out and the seats were released. Pick again.'); loadSeats(slotId); }, [slotId, loadSeats]);

  if (!event) return err ? <ErrorNote>{err}</ErrorNote> : <Spinner />;
  const slot = event.slots.find((s) => s.id === slotId);
  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900"><ArrowLeft size={15} />All events</Link>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <span className="chip bg-ink-900 text-white">{event.category}</span>
          <h1 className="mt-3 text-4xl font-bold leading-tight">{event.title}</h1>
          <ul className="mt-4 space-y-1.5 text-ink-600"><li className="flex gap-2"><MapPin size={17} className="mt-0.5" />{event.venue}</li>{event.speaker && <li className="flex gap-2"><Mic size={17} className="mt-0.5" />{event.speaker}</li>}<li>Organised by {event.organizer}</li></ul>
          <p className="mt-5 max-w-prose whitespace-pre-line leading-relaxed">{event.description}</p>

          <h2 className="mb-3 mt-8 text-xl font-bold">Choose a slot</h2>
          <div className="flex flex-wrap gap-3">
            {event.slots.map((s) => { const left = s.capacity - s.confirmedCount; return (
              <button key={s.id} disabled={!!hold} onClick={() => setSlotId(s.id)} className={`rounded-lg border px-4 py-3 text-left text-sm ${s.id === slotId ? 'border-ink-900 bg-white ring-1 ring-ink-900' : 'border-ink-200 bg-white hover:border-ink-400'} disabled:opacity-60`}>
                <div className="font-semibold">{fmtFull(s.startsAt)}</div><div className="text-ink-600">to {fmtTime(s.endsAt)} · {s.mode.toLowerCase()}</div>
                <div className={`mt-1 text-xs ${left === 0 ? 'text-brand' : 'text-ink-400'}`}>{left === 0 ? 'Full' : `${left} of ${s.capacity} left`}</div>
              </button>); })}
          </div>
        </div>

        <aside className="panel h-fit lg:sticky lg:top-6">
          <h2 className="text-lg font-bold">{hold ? 'Seats held for you' : 'Pick your seat'}</h2>
          {slot && <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-600"><CalendarClock size={15} />{fmtFull(slot.startsAt)}</div>}
          <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
          <div className="mt-4">{seats.length ? <SeatMap seats={seats} selected={hold ? hold.seats.map((s) => s.id) : selected} onToggle={toggle} disabled={!!hold} /> : <Spinner />}</div>
          <div className="mt-5 border-t border-ink-100 pt-4">
            {!hold ? (<>
              <div className="text-sm text-ink-600">{selected.length ? `Selected: ${selected.map(labelOf).join(', ')}` : `Select up to ${max} seat${max > 1 ? 's' : ''}.`}</div>
              <button className="btn-primary mt-3 w-full" disabled={!selected.length || busy} onClick={doHold}>{busy ? 'Holding…' : 'Hold seats for 5 minutes'}</button>
            </>) : (<>
              <div className="flex items-center justify-between rounded-lg bg-warn-soft p-3 text-sm text-warn"><span className="flex items-center gap-1.5"><Timer size={16} />Confirm within</span><b><Countdown until={hold.holdExpiresAt} onDone={expired} /></b></div>
              <div className="mt-3 text-sm">Seats: <b>{hold.seats.map((s) => s.label).join(', ')}</b></div>
              <div className="mt-3 flex gap-2"><button className="btn-primary flex-1" disabled={busy} onClick={doConfirm}>{busy ? 'Confirming…' : 'Confirm booking'}</button><button className="btn-ghost" disabled={busy} onClick={release}>Release</button></div>
            </>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
