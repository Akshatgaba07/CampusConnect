import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import api, { errMsg } from '../../lib/api.js';
import { ErrorNote, OkNote, Spinner, Status, Field } from '../../components/ui.jsx';
import { fmtFull, fmtTime, toLocalInput } from '../../lib/format.js';

const blank = { title: '', description: '', category: 'Seminar', venue: '', posterUrl: '', speaker: '', organizer: 'Bennett University', registrationOpens: toLocalInput(new Date()), registrationCloses: toLocalInput(new Date(Date.now() + 7 * 864e5)) };
const blankSlot = { startsAt: '', endsAt: '', capacity: 60, mode: 'OFFLINE', maxSeatsPerBooking: 2 };

export default function AdminEventEdit() {
  const { id } = useParams(); const nav = useNavigate(); const isNew = id === 'new';
  const [ev, setEv] = useState(null); const [f, setF] = useState(blank); const [slot, setSlot] = useState(blankSlot);
  const [att, setAtt] = useState([]); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const load = useCallback(async () => {
    if (isNew) return;
    const { data } = await api.get(`/admin/events/${id}`); setEv(data.event);
    setF({ ...data.event, posterUrl: data.event.posterUrl || '', speaker: data.event.speaker || '', registrationOpens: toLocalInput(data.event.registrationOpens), registrationCloses: toLocalInput(data.event.registrationCloses) });
    api.get(`/admin/events/${id}/attendees`).then((r) => setAtt(r.data.attendees));
  }, [id, isNew]);
  useEffect(() => { load().catch((e) => setErr(errMsg(e))); }, [load]);
  const act = async (fn, msg) => { setErr(''); setOk(''); try { await fn(); if (msg) setOk(msg); await load(); } catch (e) { setErr(errMsg(e)); } };

  const payload = () => ({ title: f.title, description: f.description, category: f.category, venue: f.venue, posterUrl: f.posterUrl, speaker: f.speaker || null, organizer: f.organizer, registrationOpens: new Date(f.registrationOpens).toISOString(), registrationCloses: new Date(f.registrationCloses).toISOString() });
  const save = (e) => { e.preventDefault(); act(async () => { if (isNew) { const { data } = await api.post('/admin/events', payload()); nav(`/admin/events/${data.event.id}`, { replace: true }); } else await api.put(`/admin/events/${id}`, payload()); }, 'Saved'); };
  const addSlot = (e) => { e.preventDefault(); act(async () => { await api.post(`/admin/events/${id}/slots`, { ...slot, startsAt: new Date(slot.startsAt).toISOString(), endsAt: new Date(slot.endsAt).toISOString(), capacity: Number(slot.capacity), maxSeatsPerBooking: Number(slot.maxSeatsPerBooking) }); setSlot(blankSlot); }, 'Slot added with seats generated'); };
  const csv = () => { const rows = [['Name', 'Email', 'Seat', 'Slot start', 'Checked in'], ...att.map((a) => [a.name || '', a.email, a.seat, a.slotStart, a.checkedInAt || ''])]; const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `${f.title}-attendees.csv`; a.click(); URL.revokeObjectURL(url); };

  if (!isNew && !ev) return err ? <ErrorNote>{err}</ErrorNote> : <Spinner />;
  const locked = ev && ['CANCELLED', 'COMPLETED'].includes(ev.status);
  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-bold">{isNew ? 'New event' : ev.title}</h1>{ev && <Status s={ev.status} />}</div>
      <div className="mt-4 space-y-3"><ErrorNote>{err}</ErrorNote><OkNote>{ok}</OkNote></div>

      <form onSubmit={save} className="panel mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field label="Title"><input className="input" value={f.title} onChange={set('title')} required minLength={3} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-28" value={f.description} onChange={set('description')} required minLength={10} /></Field></div>
        <Field label="Category"><input className="input" value={f.category} onChange={set('category')} required /></Field>
        <Field label="Venue"><input className="input" value={f.venue} onChange={set('venue')} required /></Field>
        <Field label="Speaker (optional)"><input className="input" value={f.speaker} onChange={set('speaker')} /></Field>
        <Field label="Organiser"><input className="input" value={f.organizer} onChange={set('organizer')} required /></Field>
        <div className="sm:col-span-2"><Field label="Poster image URL (optional)"><input className="input" type="url" value={f.posterUrl} onChange={set('posterUrl')} placeholder="https://…" /></Field></div>
        <Field label="Registration opens"><input className="input" type="datetime-local" value={f.registrationOpens} onChange={set('registrationOpens')} required /></Field>
        <Field label="Registration closes"><input className="input" type="datetime-local" value={f.registrationCloses} onChange={set('registrationCloses')} required /></Field>
        <div className="flex gap-2 sm:col-span-2"><button className="btn-primary" disabled={locked}>{isNew ? 'Create event' : 'Save changes'}</button></div>
      </form>

      {!isNew && (<>
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">Slots</h2>
          <p className="mt-1 text-sm text-ink-600">Each slot gets its own seat map. Seats are generated automatically (A1, A2 …).</p>
          <div className="mt-4 divide-y divide-ink-100">{ev.slots.length === 0 && <p className="py-3 text-sm text-ink-400">No slots yet.</p>}
            {ev.slots.map((s) => <div key={s.id} className="flex items-center justify-between py-3 text-sm"><div><b>{fmtFull(s.startsAt)}</b> to {fmtTime(s.endsAt)} · {s.mode.toLowerCase()}<div className="text-ink-600">{s.confirmedCount} / {s.capacity} booked · max {s.maxSeatsPerBooking} per student</div></div>
              <button className="btn-danger px-3 py-1.5" aria-label="Delete slot" onClick={() => confirm('Delete this slot and all its seats?') && act(() => api.delete(`/admin/slots/${s.id}`), 'Slot deleted')}><Trash2 size={15} /></button></div>)}</div>
          {!locked && <form onSubmit={addSlot} className="mt-4 grid gap-3 border-t border-ink-100 pt-4 sm:grid-cols-3">
            <Field label="Starts"><input className="input" type="datetime-local" value={slot.startsAt} onChange={(e) => setSlot({ ...slot, startsAt: e.target.value })} required /></Field>
            <Field label="Ends"><input className="input" type="datetime-local" value={slot.endsAt} onChange={(e) => setSlot({ ...slot, endsAt: e.target.value })} required /></Field>
            <Field label="Capacity (seats)"><input className="input" type="number" min="1" max="260" value={slot.capacity} onChange={(e) => setSlot({ ...slot, capacity: e.target.value })} required /></Field>
            <Field label="Mode"><select className="input" value={slot.mode} onChange={(e) => setSlot({ ...slot, mode: e.target.value })}><option>OFFLINE</option><option>ONLINE</option><option>HYBRID</option></select></Field>
            <Field label="Max seats per student"><input className="input" type="number" min="1" max="10" value={slot.maxSeatsPerBooking} onChange={(e) => setSlot({ ...slot, maxSeatsPerBooking: e.target.value })} required /></Field>
            <div className="flex items-end"><button className="btn-dark w-full">Add slot</button></div></form>}
        </section>

        <section className="panel mt-6">
          <h2 className="text-xl font-bold">Status</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {ev.status === 'DRAFT' && <button className="btn-primary" onClick={() => act(() => api.post(`/admin/events/${id}/publish`), 'Published. Students can book now.')}>Publish event</button>}
            {ev.status === 'PUBLISHED' && <><button className="btn-ghost" onClick={() => act(() => api.post(`/admin/events/${id}/complete`), 'Marked completed')}>Mark completed</button>
              <button className="btn-danger" onClick={() => confirm('Cancel this event? Every attendee is emailed and all tickets are voided.') && act(() => api.post(`/admin/events/${id}/cancel`), 'Event cancelled and attendees notified')}>Cancel event</button></>}
            {locked && <span className="text-sm text-ink-600">This event is {ev.status.toLowerCase()} and can no longer be changed.</span>}
          </div>
        </section>

        <section className="panel mt-6">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Attendees ({att.length})</h2>{att.length > 0 && <button className="btn-ghost px-3 py-1.5" onClick={csv}><Download size={15} />CSV</button>}</div>
          {att.length === 0 ? <p className="mt-3 text-sm text-ink-400">No confirmed bookings yet.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-ink-600"><tr><th className="py-2 font-medium">Student</th><th className="py-2 font-medium">Seat</th><th className="py-2 font-medium">Slot</th><th className="py-2 font-medium">Entry</th></tr></thead>
            <tbody className="divide-y divide-ink-100">{att.map((a, i) => <tr key={i}><td className="py-2.5">{a.name || '—'}<div className="text-ink-600">{a.email}</div></td><td className="py-2.5 font-semibold">{a.seat}</td><td className="py-2.5">{fmtFull(a.slotStart)}</td><td className="py-2.5">{a.checkedInAt ? <span className="chip bg-ok-soft text-ok">Checked in</span> : <span className="text-ink-400">Not yet</span>}</td></tr>)}</tbody></table></div>}
        </section>
      </>)}
    </div>
  );
}
