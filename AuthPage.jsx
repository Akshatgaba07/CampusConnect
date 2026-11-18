import { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail, ShieldCheck } from 'lucide-react';
import api, { errMsg } from '../../lib/api.js';
import { useAuth } from '../../store/auth.js';
import { ErrorNote, OkNote } from '../../components/ui.jsx';

const rules = [['10+ characters', (p) => p.length >= 10], ['Lowercase', (p) => /[a-z]/.test(p)], ['Uppercase', (p) => /[A-Z]/.test(p)], ['Number', (p) => /[0-9]/.test(p)], ['Symbol', (p) => /[^A-Za-z0-9]/.test(p)]];
const DOMAIN = '@bennett.edu.in';

function PasswordInput({ value, onChange, autoComplete, id }) {
  const [show, setShow] = useState(false); // characters are hidden by default
  return (
    <div className="relative">
      <input id={id} className="input pr-11" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-400 hover:text-ink-900" onClick={() => setShow(!show)}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
    </div>
  );
}

export default function AuthPage() {
  const setSession = useAuth((s) => s.setSession);
  const [mode, setMode] = useState('login'); // login | register | reset
  const [step, setStep] = useState('email'); // email | otp | password   (login uses email+password on one screen)
  const [email, setEmail] = useState(''); const [otp, setOtp] = useState(''); const [pw, setPw] = useState(''); const [name, setName] = useState('');
  const [regToken, setRegToken] = useState(''); const [err, setErr] = useState(''); const [info, setInfo] = useState(''); const [busy, setBusy] = useState(false); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(cooldown - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const em = email.trim().toLowerCase();
  const emailOk = em.endsWith(DOMAIN) && em.length > DOMAIN.length;
  const purpose = mode === 'reset' ? 'RESET' : 'REGISTER';
  const switchMode = (m) => { setMode(m); setStep('email'); setErr(''); setInfo(''); setOtp(''); setPw(''); };
  const run = async (fn) => { setBusy(true); setErr(''); setInfo(''); try { await fn(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); } };

  const sendOtp = () => run(async () => {
    if (!emailOk) throw { response: { data: { error: `Use your Bennett email ending in ${DOMAIN}` } } };
    const { data } = await api.post('/auth/request-otp', { email: em, purpose });
    setStep('otp'); setCooldown(60); setInfo(data.message);
  });
  const verify = () => run(async () => { const { data } = await api.post('/auth/verify-otp', { email: em, otp, purpose }); setRegToken(data.registrationToken); setStep('password'); });
  const finish = () => run(async () => { const { data } = await api.post('/auth/set-password', { registrationToken: regToken, password: pw, name: name || undefined }); setSession(data); });
  const login = () => run(async () => { const { data } = await api.post('/auth/login', { email: em, password: pw }); setSession(data); });

  const heading = mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create your account' : 'Reset your password';
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <div className="font-display text-xl font-bold">CampusConnect</div>
        <div>
          <h1 className="max-w-md text-5xl font-bold leading-[1.05]">Your seat, held for you. Your ticket, one scan.</h1>
          <p className="mt-5 max-w-md text-ink-200">Book talks, workshops and fests at Bennett University. Every seat is reserved for one student at a time, and your QR ticket carries the event, slot and seat.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-400"><ShieldCheck size={16} />Sign-in is limited to {DOMAIN} addresses.</div>
      </section>
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold">{heading}</h2>
          <p className="mb-6 mt-1 text-sm text-ink-600">{mode === 'login' ? 'Use your Bennett email and password.' : step === 'email' ? 'We will email a 6-digit code to verify it is you.' : step === 'otp' ? `Enter the code sent to ${em}.` : 'Choose a password. It is stored only as a one-way hash.'}</p>
          <div className="space-y-4">
            <ErrorNote>{err}</ErrorNote><OkNote>{info}</OkNote>
            {mode === 'login' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); login(); }}>
                <div><label className="label" htmlFor="em">Bennett email</label><input id="em" className="input" type="email" autoComplete="username" placeholder={`s24cseu0000${DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div><label className="label" htmlFor="pw">Password</label><PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="current-password" /></div>
                <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
                <div className="flex justify-between text-sm"><button type="button" className="text-brand hover:underline" onClick={() => switchMode('register')}>New here? Create account</button><button type="button" className="text-ink-600 hover:underline" onClick={() => switchMode('reset')}>Forgot password?</button></div>
              </form>
            )}
            {mode !== 'login' && step === 'email' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); sendOtp(); }}>
                <div><label className="label" htmlFor="em2">Bennett email</label><div className="relative"><Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input id="em2" className="input pl-9" type="email" placeholder={`s24cseu0000${DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} required /></div></div>
                <button className="btn-primary w-full" disabled={busy || !emailOk}>{busy ? 'Sending…' : 'Send code'}</button>
                <button type="button" className="text-sm text-brand hover:underline" onClick={() => switchMode('login')}>Back to sign in</button>
              </form>
            )}
            {mode !== 'login' && step === 'otp' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); verify(); }}>
                <div><label className="label" htmlFor="otp">6-digit code</label><input id="otp" className="input text-center text-2xl font-semibold tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required /></div>
                <button className="btn-primary w-full" disabled={busy || otp.length !== 6}>{busy ? 'Checking…' : 'Verify email'}</button>
                <div className="flex justify-between text-sm"><button type="button" className="text-ink-600 hover:underline" onClick={() => setStep('email')}>Change email</button><button type="button" className="text-brand hover:underline disabled:text-ink-400 disabled:no-underline" disabled={cooldown > 0 || busy} onClick={sendOtp}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button></div>
              </form>
            )}
            {mode !== 'login' && step === 'password' && (
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); finish(); }}>
                {mode === 'register' && <div><label className="label" htmlFor="nm">Full name</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} /></div>}
                <div><label className="label" htmlFor="np">{mode === 'reset' ? 'New password' : 'Password'}</label><PasswordInput id="np" value={pw} onChange={setPw} autoComplete="new-password" /></div>
                <ul className="flex flex-wrap gap-1.5">{rules.map(([l, f]) => <li key={l} className={`chip ${f(pw) ? 'bg-ok-soft text-ok' : 'bg-ink-100 text-ink-600'}`}>{l}</li>)}</ul>
                <button className="btn-primary w-full" disabled={busy || !rules.every(([, f]) => f(pw))}>{busy ? 'Saving…' : mode === 'reset' ? 'Save password' : 'Create account'}</button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
