import { useEffect, useState } from 'react';
import api, { errMsg } from '../../lib/api.js';
import { ErrorNote, Spinner, Status } from '../../components/ui.jsx';
import { fmtFull } from '../../lib/format.js';
import { useAuth } from '../../store/auth.js';

export default function People() {
  const me = useAuth((s) => s.user); const [tab, setTab] = useState('users'); const [users, setUsers] = useState(null); const [logs, setLogs] = useState(null); const [err, setErr] = useState('');
  const loadUsers = () => api.get('/admin/users').then((r) => setUsers(r.data.users)).catch((e) => setErr(errMsg(e)));
  useEffect(() => { loadUsers(); api.get('/admin/audit-logs').then((r) => setLogs(r.data.logs)).catch((e) => setErr(errMsg(e))); }, []);
  const toggle = async (u) => { setErr(''); try { await api.patch(`/admin/users/${u.id}/status`, { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }); loadUsers(); } catch (e) { setErr(errMsg(e)); } };
  const T = ({ id, children }) => <button onClick={() => setTab(id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === id ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 border border-ink-200'}`}>{children}</button>;
  return (
    <div>
      <h1 className="text-3xl font-bold">People &amp; audit</h1>
      <div className="mt-5 flex gap-2"><T id="users">Students</T><T id="audit">Audit log</T></div>
      <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>
      {tab === 'users' && (!users ? <Spinner /> : <div className="panel mt-4 overflow-x-auto p-0"><table className="w-full text-left text-sm"><thead className="border-b border-ink-100 text-ink-600"><tr><th className="p-4 font-medium">User</th><th className="p-4 font-medium">Role</th><th className="p-4 font-medium">Last sign-in</th><th className="p-4 font-medium">Status</th><th /></tr></thead>
        <tbody className="divide-y divide-ink-100">{users.map((u) => <tr key={u.id}><td className="p-4">{u.name || '—'}<div className="text-ink-600">{u.email}</div></td><td className="p-4"><Status s={u.role} /></td><td className="p-4">{u.lastLogin ? fmtFull(u.lastLogin) : 'Never'}</td><td className="p-4"><Status s={u.status} /></td>
          <td className="p-4 text-right">{u.id !== me.id && <button className="btn-ghost px-3 py-1.5" onClick={() => toggle(u)}>{u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}</button>}</td></tr>)}</tbody></table></div>)}
      {tab === 'audit' && (!logs ? <Spinner /> : <div className="panel mt-4 overflow-x-auto p-0"><table className="w-full text-left text-sm"><thead className="border-b border-ink-100 text-ink-600"><tr><th className="p-4 font-medium">When</th><th className="p-4 font-medium">Who</th><th className="p-4 font-medium">Action</th><th className="p-4 font-medium">Target</th></tr></thead>
        <tbody className="divide-y divide-ink-100">{logs.map((l) => <tr key={l.id}><td className="p-4 whitespace-nowrap">{fmtFull(l.createdAt)}</td><td className="p-4">{l.actor?.email || 'system'}</td><td className="p-4 font-semibold">{l.action.replaceAll('_', ' ').toLowerCase()}</td><td className="p-4 text-ink-600">{l.entityType} {l.entityId?.slice(0, 8)}</td></tr>)}</tbody></table></div>)}
    </div>
  );
}
