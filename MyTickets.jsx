import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../lib/api.js';
import TicketCard from '../../components/TicketCard.jsx';
import { Empty, ErrorNote, Spinner, Status } from '../../components/ui.jsx';
import { fmtFull } from '../../lib/format.js';

export default function MyTickets() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  const load = () => api.get('/bookings/mine').then((r) => setRows(r.data.bookings)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { load(); }, []);
  const cancel = async (b) => { if (!confirm(`Cancel your booking for ${b.event.title}? Your QR codes will stop working.`)) return; try { await api.post(`/bookings/${b.id}/cancel`); load(); } catch (e) { setErr(errMsg(e)); } };
  if (!rows) return err ? <ErrorNote>{err}</ErrorNote> : <Spinner />;
  const live = rows.filter((b) => b.status === 'CONFIRMED'); const past = rows.filter((b) => b.status !== 'CONFIRMED');
  return (
    <div>
      <h1 className="text-3xl font-bold">My tickets</h1>
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {live.length === 0 && <div className="mt-6"><Empty title="No tickets yet" hint="Book a seat and your QR ticket will show up here and in your inbox."><Link to="/" className="btn-primary">Browse events</Link></Empty></div>}
      <div className="mt-6 space-y-8">
        {live.map((b) => (
          <section key={b.id}>
            <div className="mb-3 flex items-center justify-between"><div className="text-sm text-ink-600">{b.quantity} seat{b.quantity > 1 ? 's' : ''} · booked {fmtFull(b.confirmedAt)}</div><button className="btn-danger px-3 py-1.5" onClick={() => cancel(b)}>Cancel booking</button></div>
            <div className="space-y-4">{b.seats.map((s) => <TicketCard key={s.id} booking={b} seat={s} />)}</div>
          </section>
        ))}
      </div>
      {past.length > 0 && (<><h2 className="mb-3 mt-10 text-xl font-bold">History</h2>
        <div className="panel divide-y divide-ink-100 p-0">{past.map((b) => <div key={b.id} className="flex items-center justify-between p-4 text-sm"><div><div className="font-semibold">{b.event.title}</div><div className="text-ink-600">{fmtFull(b.slot.startsAt)} · {b.seats.map((s) => s.label).join(', ')}</div></div><Status s={b.status} /></div>)}</div></>)}
    </div>
  );
}
