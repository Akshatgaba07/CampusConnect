import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errMsg } from '../../lib/api.js';
import { ErrorNote, Spinner } from '../../components/ui.jsx';

const COLORS = ['#d6303a', '#111f35', '#3c4f6e', '#7686a3', '#c9d1e0'];
const Stat = ({ label, value }) => <div className="panel"><div className="text-sm text-ink-600">{label}</div><div className="mt-1 font-display text-4xl font-bold">{value}</div></div>;

export default function Dashboard() {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api.get('/admin/analytics').then((r) => setD(r.data)).catch((e) => setErr(errMsg(e))); }, []);
  if (!d) return err ? <ErrorNote>{err}</ErrorNote> : <Spinner />;
  return (
    <div>
      <h1 className="text-3xl font-bold">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered students" value={d.totals.users} /><Stat label="Live events" value={d.totals.publishedEvents} />
        <Stat label="Seats booked" value={d.totals.seatsBooked} /><Stat label="Checked in" value={d.totals.checkedIn} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel"><h2 className="mb-3 text-lg font-bold">Seats booked, last 14 days</h2>
          {d.perDay.length ? <ResponsiveContainer width="100%" height={240}><LineChart data={d.perDay}><CartesianGrid stroke="#e4e9f2" vertical={false} /><XAxis dataKey="day" tick={{ fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fontSize: 12 }} /><Tooltip /><Line dataKey="seats" stroke="#d6303a" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer> : <p className="py-16 text-center text-sm text-ink-400">No bookings in the last 14 days.</p>}</section>
        <section className="panel"><h2 className="mb-3 text-lg font-bold">Bookings by category</h2>
          {d.byCategory.some((c) => c.value > 0) ? <ResponsiveContainer width="100%" height={240}><PieChart><Pie data={d.byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>{d.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <p className="py-16 text-center text-sm text-ink-400">Nothing booked yet.</p>}
          <ul className="mt-2 flex flex-wrap gap-3 text-xs text-ink-600">{d.byCategory.map((c, i) => <li key={c.name} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />{c.name}</li>)}</ul></section>
        <section className="panel lg:col-span-2"><h2 className="mb-3 text-lg font-bold">Seats filled per live event</h2>
          {d.fill.length ? <ResponsiveContainer width="100%" height={Math.max(180, d.fill.length * 44)}><BarChart data={d.fill} layout="vertical" margin={{ left: 40 }}><CartesianGrid stroke="#e4e9f2" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="capacity" fill="#e4e9f2" radius={4} /><Bar dataKey="booked" fill="#111f35" radius={4} /></BarChart></ResponsiveContainer> : <p className="py-10 text-center text-sm text-ink-400">Publish an event to see fill rates.</p>}</section>
      </div>
    </div>
  );
}
