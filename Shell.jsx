import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { CalendarDays, LayoutDashboard, LogOut, QrCode, ScanLine, Ticket, Users } from 'lucide-react';
import { useAuth } from '../store/auth.js';

const NAV = {
  student: [{ to: '/', label: 'Events', icon: CalendarDays, end: true }, { to: '/tickets', label: 'My tickets', icon: Ticket }],
  admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true }, { to: '/admin/events', label: 'Events', icon: CalendarDays },
    { to: '/admin/check-in', label: 'Check-in', icon: ScanLine }, { to: '/admin/people', label: 'People & audit', icon: Users },
  ],
};

export function Shell({ kind }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[kind];
  const link = ({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white text-ink-950' : 'text-ink-200 hover:bg-ink-800'}`;
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-ink-900 p-4 text-white md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0">
        <div className="mb-4 flex items-center gap-2 px-1 md:mb-8">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand"><QrCode size={18} /></span>
          <div className="font-display text-lg font-bold leading-none">CampusConnect<div className="mt-1 font-sans text-[11px] font-normal text-ink-400">{kind === 'admin' ? 'Organiser console' : 'Bennett University'}</div></div>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">{items.map((i) => <NavLink key={i.to} to={i.to} end={i.end} className={link}><i.icon size={17} />{i.label}</NavLink>)}</nav>
        <div className="mt-4 border-t border-ink-800 pt-4 md:absolute md:bottom-4 md:left-4 md:right-4">
          <div className="truncate px-1 text-xs text-ink-400">{user.email}</div>
          <button className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-200 hover:bg-ink-800" onClick={async () => { await logout(); nav('/login'); }}><LogOut size={17} />Sign out</button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-8"><Outlet /></main>
    </div>
  );
}
