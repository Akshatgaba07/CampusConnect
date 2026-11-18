import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, Clock, ScanLine, XCircle } from 'lucide-react';
import api, { errMsg } from '../../lib/api.js';
import { ErrorNote } from '../../components/ui.jsx';
import { fmtFull, fmtTime } from '../../lib/format.js';

const TONE = {
  VALID: { cls: 'border-ok bg-ok-soft', icon: CheckCircle2, color: 'text-ok', title: 'Valid ticket' },
  ADMITTED: { cls: 'border-ok bg-ok-soft', icon: CheckCircle2, color: 'text-ok', title: 'Admitted' },
  ALREADY_USED: { cls: 'border-warn bg-warn-soft', icon: Clock, color: 'text-warn', title: 'Already used' },
  TOO_EARLY: { cls: 'border-warn bg-warn-soft', icon: Clock, color: 'text-warn', title: 'Too early' },
  SLOT_ENDED: { cls: 'border-warn bg-warn-soft', icon: Clock, color: 'text-warn', title: 'Slot ended' },
  INVALID: { cls: 'border-brand bg-brand-soft', icon: XCircle, color: 'text-brand-dark', title: 'Not valid' },
};

export default function CheckIn() {
  const [qr, setQr] = useState(''); const [res, setRes] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [camera, setCamera] = useState(false);
  const scanner = useRef(null); const lastScan = useRef('');

  const verify = useCallback(async (code) => {
    setBusy(true); setErr(''); setQr(code);
    try { const { data } = await api.post('/admin/tickets/verify', { qr: code }); setRes(data); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  }, []);
  const admit = async () => { setBusy(true); setErr(''); try { const { data } = await api.post('/admin/tickets/check-in', { qr }); setRes(data); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };
  const reset = () => { setRes(null); setQr(''); lastScan.current = ''; setErr(''); };

  useEffect(() => {
    if (!camera) return;
    const s = new Html5Qrcode('qr-reader'); scanner.current = s;
    s.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => { if (text !== lastScan.current) { lastScan.current = text; verify(text); } }, () => {}).catch(() => { setErr('Camera unavailable. Allow camera access, or paste the code below.'); setCamera(false); });
    return () => { s.isScanning ? s.stop().then(() => s.clear()).catch(() => {}) : s.clear(); };
  }, [camera, verify]);

  const tone = res && (TONE[res.result] || TONE.INVALID); const Icon = tone?.icon;
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold">Check-in</h1>
      <p className="mt-1 text-ink-600">Scan a student's QR at the entrance. Details are looked up live, so a cancelled ticket fails even if the screenshot is real.</p>
      <div className="mt-6 space-y-4">
        <ErrorNote>{err}</ErrorNote>
        {!res && (<>
          <div className="panel">
            {camera ? <div id="qr-reader" className="overflow-hidden rounded-lg" /> : <button className="btn-dark w-full py-6" onClick={() => setCamera(true)}><ScanLine size={20} />Start camera scan</button>}
            {camera && <button className="btn-ghost mt-3" onClick={() => setCamera(false)}>Stop camera</button>}
          </div>
          <form className="panel flex gap-2" onSubmit={(e) => { e.preventDefault(); verify(qr.trim()); }}>
            <input className="input" placeholder="Or paste the ticket code (CC1.…)" value={qr} onChange={(e) => setQr(e.target.value)} aria-label="Ticket code" />
            <button className="btn-primary" disabled={busy || qr.length < 10}>Verify</button>
          </form>
        </>)}
        {res && (
          <div className={`rounded-xl border-2 p-5 ${tone.cls}`}>
            <div className={`flex items-center gap-2 font-display text-2xl font-bold ${tone.color}`}><Icon size={26} />{tone.title}</div>
            <p className="mt-1 text-sm">{res.message}</p>
            {res.eventTitle && (
              <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-lg bg-white p-4 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2"><dt className="text-ink-400">Event</dt><dd className="font-display text-lg font-bold">{res.eventTitle}</dd></div>
                <div><dt className="text-ink-400">Seat</dt><dd className="font-display text-3xl font-bold">{res.seat}</dd></div>
                <div><dt className="text-ink-400">Slot</dt><dd className="font-semibold">{fmtFull(res.slotStart)} to {fmtTime(res.slotEnd)}</dd></div>
                <div><dt className="text-ink-400">Attendee</dt><dd className="font-semibold">{res.attendeeName || '—'}</dd><dd className="text-ink-600">{res.attendeeEmail}</dd></div>
                <div><dt className="text-ink-400">Venue / mode</dt><dd className="font-semibold">{res.venue} · {res.mode?.toLowerCase()}</dd></div>
                {res.speaker && <div><dt className="text-ink-400">Speaker</dt><dd>{res.speaker}</dd></div>}
                {res.checkedInAt && <div><dt className="text-ink-400">Checked in at</dt><dd>{fmtFull(res.checkedInAt)}</dd></div>}
              </dl>)}
            <div className="mt-4 flex gap-2">
              {res.result === 'VALID' && <button className="btn-primary" disabled={busy} onClick={admit}>{busy ? 'Admitting…' : 'Admit'}</button>}
              <button className="btn-ghost" onClick={reset}>Scan next</button>
            </div>
          </div>)}
      </div>
    </div>
  );
}
