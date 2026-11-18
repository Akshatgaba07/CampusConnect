import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import api, { errMsg } from '../../lib/api.js';
import { Empty, ErrorNote, Spinner, Status } from '../../components/ui.jsx';
import { fmtFull } from '../../lib/format.js';

export default function AdminEvents() {
  const [rows, setRows] = useState(null); const [err, setErr] = useState(''); const nav = useNavigate();
  useEffect(() => { api.get('/admin/events').then((r) => setRows(r.data.events)).catch((e) => setErr(errMsg(e))); }, []);
  return (
    <div>
      <div className="flex items-center justify-between"><h1 className="text-3xl font-bold">Events</h1><button className="btn-primary" onClick={() => nav('/admin/events/new')}><Plus size={17} />New event</button></div>
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {!rows && !err && <Spinner />}
      {rows?.length === 0 && <div className="mt-6"><Empty title="No events yet" hint="Create an event, add a slot with a capacity, then publish it so students can book." /></div>}
      {rows?.length > 0 && (
        <div className="panel mt-6 overflow-x-auto p-0"><table className="w-full text-left text-sm">
          <thead className="border-b border-ink-100 text-ink-600"><tr><th className="p-4 font-medium">Event</th><th className="p-4 font-medium">First slot</th><th className="p-4 font-medium">Booked</th><th className="p-4 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-ink-100">{rows.map((e) => { const cap = e.slots.reduce((n, s) => n + s.capacity, 0), booked = e.slots.reduce((n, s) => n + s.confirmedCount, 0);
            return <tr key={e.id} className="hover:bg-ink-50"><td className="p-4"><Link to={`/admin/events/${e.id}`} className="font-semibold hover:text-brand">{e.title}</Link><div className="text-ink-600">{e.category} · {e.venue}</div></td>
              <td className="p-4">{e.slots[0] ? fmtFull(e.slots[0].startsAt) : <span className="text-ink-400">No slots</span>}</td><td className="p-4 tabular-nums">{booked} / {cap}</td><td className="p-4"><Status s={e.status} /></td></tr>; })}</tbody>
        </table></div>
      )}
    </div>
  );
}
