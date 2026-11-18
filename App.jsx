import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth.js';
import { Shell } from './components/Shell.jsx';
import AuthPage from './pages/auth/AuthPage.jsx';
import Events from './pages/student/Events.jsx';
import EventDetail from './pages/student/EventDetail.jsx';
import MyTickets from './pages/student/MyTickets.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import AdminEvents from './pages/admin/AdminEvents.jsx';
import AdminEventEdit from './pages/admin/AdminEventEdit.jsx';
import CheckIn from './pages/admin/CheckIn.jsx';
import People from './pages/admin/People.jsx';

function Guard({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />;
  return children;
}

export default function App() {
  const { ready, boot, user } = useAuth();
  useEffect(() => { boot(); }, [boot]);
  if (!ready) return <div className="grid min-h-screen place-items-center text-ink-400">Loading…</div>;
  const home = user?.role === 'ADMIN' ? '/admin' : '/';
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home} replace /> : <AuthPage />} />
      <Route element={<Guard role="STUDENT"><Shell kind="student" /></Guard>}>
        <Route path="/" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/tickets" element={<MyTickets />} />
      </Route>
      <Route path="/admin" element={<Guard role="ADMIN"><Shell kind="admin" /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="events/:id" element={<AdminEventEdit />} />
        <Route path="check-in" element={<CheckIn />} />
        <Route path="people" element={<People />} />
      </Route>
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}
