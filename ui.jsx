import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export const Spinner = () => <div className="flex items-center gap-2 py-10 text-ink-400"><Loader2 className="animate-spin" size={18} />Loading…</div>;
export const ErrorNote = ({ children }) => children ? <div role="alert" className="flex items-start gap-2 rounded-lg bg-brand-soft p-3 text-sm text-brand-dark"><AlertCircle size={16} className="mt-0.5 shrink-0" />{children}</div> : null;
export const OkNote = ({ children }) => children ? <div role="status" className="flex items-start gap-2 rounded-lg bg-ok-soft p-3 text-sm text-ok"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{children}</div> : null;
export const Empty = ({ title, hint, children }) => <div className="rounded-xl border border-dashed border-ink-200 p-10 text-center"><div className="font-display text-lg font-bold">{title}</div><p className="mx-auto mt-1 max-w-sm text-sm text-ink-600">{hint}</p>{children && <div className="mt-4">{children}</div>}</div>;
const TONES = { PUBLISHED: 'bg-ok-soft text-ok', CONFIRMED: 'bg-ok-soft text-ok', ADMITTED: 'bg-ok-soft text-ok', ACTIVE: 'bg-ok-soft text-ok', PENDING: 'bg-warn-soft text-warn', DRAFT: 'bg-ink-100 text-ink-600', CANCELLED: 'bg-brand-soft text-brand-dark', EXPIRED: 'bg-ink-100 text-ink-600', COMPLETED: 'bg-ink-100 text-ink-600', SUSPENDED: 'bg-brand-soft text-brand-dark', ADMIN: 'bg-ink-900 text-white', STUDENT: 'bg-ink-100 text-ink-600' };
export const Status = ({ s }) => <span className={`chip ${TONES[s] || 'bg-ink-100 text-ink-600'}`}>{s.charAt(0) + s.slice(1).toLowerCase()}</span>;
export const Field = ({ label, children }) => <label className="block"><span className="label">{label}</span>{children}</label>;
