import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Search, Users } from 'lucide-react';
import api, { errMsg } from '../../lib/api.js';
import { fmtDate, fmtTime } from '../../lib/format.js';
import { Empty, ErrorNote, Spinner } from '../../components/ui.jsx';

export default function Events() {
  const [events, setEvents] = useState(null); const [err, setErr] = useState(''); const [q, setQ] = useState(''); const [cat, setCat] = useState('All');
  useEffect(() => { api.get('/events').then((r) => setEvents(r.data.events)).catch((e) => setErr(errMsg(e))); }, []);
  const cats = useMemo(() => ['All', ...new Set((events || []).map((e) => e.category))], [events]);
  const list = (events || []).filter((e) => (cat === 'All' || e.category === cat) && `${e.title} ${e.speaker || ''} ${e.organizer}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1 className="text-3xl font-bold">What's on</h1>
      <p className="mt-1 text-ink-600">Pick an event, choose a slot, then your seat.</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input pl-9" placeholder="Search events or speakers" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap gap-2">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`chip px-3 py-1.5 ${cat === c ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}>{c}</button>)}</div>
      </div>
      <div className="mt-6"><ErrorNote>{err}</ErrorNote></div>
      {!events && !err && <Spinner />}
      {events && list.length === 0 && <Empty title="No events match" hint="Try another category or clear the search. New events appear here as organisers publish them." />}
      <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((e) => {
          const free = e.slots.reduce((n, s) => n + s.capacity - s.confirmedCount, 0); const first = e.slots[0];
          return (
            <Link key={e.id} to={`/events/${e.id}`} className="group overflow-hidden rounded-xl border border-ink-100 bg-white hover:border-ink-400">
              <div className="h-36 bg-ink-800 bg-cover bg-center" style={e.posterUrl ? { backgroundImage: `url(${e.posterUrl})` } : undefined}>
                {!e.posterUrl && <div className="flex h-full items-end p-4 font-display text-3xl font-bold text-white/90">{e.category}</div>}
              </div>
              <div className="p-4">
                <div className="font-display text-lg font-bold leading-snug group-hover:text-brand">{e.title}</div>
                <div className="mt-1 text-sm text-ink-600">{e.organizer}{e.speaker ? ` · ${e.speaker}` : ''}</div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-600">
                  {first && <span className="flex items-center gap-1.5"><CalendarDays size={15} />{fmtDate(first.startsAt)}, {fmtTime(first.startsAt)}</span>}
                  <span className="flex items-center gap-1.5"><MapPin size={15} />{e.venue}</span>
                  <span className={`flex items-center gap-1.5 ${free === 0 ? 'text-brand' : ''}`}><Users size={15} />{free === 0 ? 'Full' : `${free} seats left`}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
