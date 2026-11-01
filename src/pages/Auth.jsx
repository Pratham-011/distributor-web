import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, takeNotice } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../components/Icons.jsx';
import { Notice, PasswordInput } from '../components/ui.jsx';
import { StateSelect } from '../states.jsx';
import { SupportInfo } from '../components/Support.jsx';

function Shell({ title, sub, children }) {
  return (
    <div className="auth-wrap">
      <div className="auth">
        <div className="logo">{Icon.logo}</div>
        <h1>{title}</h1>
        {sub && <p className="muted" style={{ marginBottom: 0 }}>{sub}</p>}
        {children}
      </div>
      <p className="small muted auth-help">Need help? <SupportInfo compact /></p>
    </div>
  );
}

const Field = ({ label, hint, ...p }) => (
  <label className="field"><span>{label}</span>{p.type === 'password' ? <PasswordInput {...p} /> : <input {...p} />}{hint && <small>{hint}</small>}</label>
);

function useForm(init) {
  const [v, setV] = useState(init);
  const on = k => e => setV(s => ({ ...s, [k]: e.target.value }));
  return [v, on, setV];
}

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [v, on] = useForm({ email: '', password: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [other, setOther] = useState(false);              // the person is already signed in on another device
  const [notice] = useState(() => takeNotice());           // e.g. "You were signed out because this account was opened on another device."
  async function submit(e) {
    e.preventDefault(); setErr(''); setOther(false); setBusy(true);
    try { signIn(await api('/auth/login', { method: 'POST', body: v })); nav('/'); }
    catch (e) { setErr(e.message); setOther(e.data?.code === 'already_signed_in'); } finally { setBusy(false); }
  }
  return (
    <Shell title="Log in" sub="Welcome back. Please enter your email and password.">
      {notice && !err && <Notice tone="warn">{notice}</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}
      {other && <p className="small muted" style={{ marginTop: -6 }}>Each person can use one device at a time. Choose <b>Log out</b> on the other device, or <Link to="/forgot">reset your password</Link> to sign it out.</p>}
      <form onSubmit={submit}>
        <Field label="Email" type="email" autoComplete="email" required value={v.email} onChange={on('email')} />
        <Field label="Password" type="password" autoComplete="current-password" required value={v.password} onChange={on('password')} />
        <button className="btn primary big" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="switch"><Link to="/forgot">Forgot password?</Link></div>
      <div className="switch">New here? <Link to="/register">Create an account</Link></div>
    </Shell>
  );
}

export function Register() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [v, on, setV] = useForm({ name: '', email: '', business_name: '', state_code: '', password: '' });
  const [step, setStep] = useState(1);
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);

  async function start(e) {
    e?.preventDefault(); setErr(''); setBusy(true);
    try { setSent(await api('/auth/register', { method: 'POST', body: v })); setStep(2); setCode(''); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function verify(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { signIn(await api('/auth/verify', { method: 'POST', body: { email: v.email, code } })); nav('/'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (step === 2) return (
    <Shell title="Enter the code" sub={`We sent a 6-digit code to ${v.email}.`}>
      {sent?.demo_code && <div className="demo-code"><div className="small">Demo mode: no email is sent. Your code is</div><b>{sent.demo_code}</b></div>}
      {sent?.joining && <Notice tone="info">You are joining <b>{sent.joining}</b>.</Notice>}
      {err && <Notice tone="bad">{err}</Notice>}
      <form onSubmit={verify}>
        <label className="field"><span>6-digit code</span>
          <input className="otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></label>
        <button className="btn primary big" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Confirm and continue'}</button>
      </form>
      <div className="switch"><button className="btn link" onClick={start} disabled={busy}>Send a new code</button> · <button className="btn link" onClick={() => setStep(1)}>Change details</button></div>
    </Shell>
  );

  return (
    <Shell title="Create an account" sub="If someone in your business already added you, use the same email and you will join them.">
      {err && <Notice tone="bad">{err}</Notice>}
      <form onSubmit={start}>
        <Field label="Your name" required autoComplete="name" value={v.name} onChange={on('name')} type="text" />
        <Field label="Email" type="email" required autoComplete="email" value={v.email} onChange={on('email')} />
        <Field label="Business name" type="text" value={v.business_name} onChange={on('business_name')} hint="Not needed if you were invited." />
        <label className="field"><span>State where your business is GST-registered</span>
          <StateSelect value={v.state_code} onChange={s => setV(x => ({ ...x, state_code: s }))} />
          <small>The first two digits of your GSTIN. Used to check IGST on out-of-state bills. Not needed if you were invited.</small></label>
        <Field label="Password" type="password" required minLength={10} autoComplete="new-password" value={v.password} onChange={on('password')} hint="At least 10 characters." />
        <button className="btn primary big" disabled={busy}>{busy ? 'Please wait…' : 'Send me a code'}</button>
      </form>
      <div className="switch">Already have an account? <Link to="/login">Log in</Link></div>
    </Shell>
  );
}

export function Forgot() {
  const nav = useNavigate();
  const [v, on] = useForm({ email: '', code: '', password: '' });
  const [sent, setSent] = useState(null);
  const [err, setErr] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { setSent(await api('/auth/forgot', { method: 'POST', body: { email: v.email } })); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function reset(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api('/auth/reset', { method: 'POST', body: v }); setDone(true); setTimeout(() => nav('/login'), 1500); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <Shell title="Reset password" sub={sent ? `If ${v.email} has an account, a code has been sent.` : 'We will send a code to your email.'}>
      {err && <Notice tone="bad">{err}</Notice>}
      {done && <Notice tone="good">Password changed. Taking you to log in…</Notice>}
      {!sent ? (
        <form onSubmit={send}>
          <Field label="Email" type="email" required value={v.email} onChange={on('email')} />
          <button className="btn primary big" disabled={busy}>Send code</button>
        </form>
      ) : (
        <form onSubmit={reset}>
          {sent.demo_code && <div className="demo-code"><div className="small">Demo mode code</div><b>{sent.demo_code}</b></div>}
          <label className="field"><span>6-digit code</span><input className="otp" type="text" inputMode="numeric" maxLength={6} required value={v.code} onChange={on('code')} /></label>
          <Field label="New password" type="password" required minLength={10} value={v.password} onChange={on('password')} hint="At least 10 characters." />
          <button className="btn primary big" disabled={busy}>Change password</button>
        </form>
      )}
      <div className="switch"><Link to="/login">Back to log in</Link></div>
    </Shell>
  );
}
