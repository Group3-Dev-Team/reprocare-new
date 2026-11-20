import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Heart, Ticket } from 'lucide-react';
import { dashboardHome, useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { images } from '../data/images';
import { Checkbox, isKenyanPhone, PasswordInput, PHONE_ERROR, StrengthMeter, TextInput } from '../components/Forms';
import { useToast } from '../components/Toast';
import { Alert } from '../components/Feedback';

/** Only allow in-app redirects after sign-in ("/dashboard", not "//evil.example" or "https://…"). */
export function safeNext(value) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  return value;
}

/** Segmented Sign in / Create account switch at the top of both auth cards. */
export function AuthSwitch({ active, next }) {
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <nav className="auth-switch" aria-label="Account">
      <Link to={`/sign-in${q}`} aria-current={active === 'sign-in' ? 'page' : undefined}>
        Sign in
      </Link>
      <Link to={`/register${q}`} aria-current={active === 'register' ? 'page' : undefined}>
        Create account
      </Link>
    </nav>
  );
}

export function AuthAside() {
  return (
    <aside className="auth-aside">
      <img src={images.family.src} alt="" />
      <h2>One place for your next steps</h2>
      <ul>
        <li>
          <Heart size={18} aria-hidden="true" /> Save facilities you are considering
        </li>
        <li>
          <CalendarCheck size={18} aria-hidden="true" /> Send appointment requests and see when they are confirmed
        </li>
        <li>
          <Ticket size={18} aria-hidden="true" /> Keep programme registration references together
        </li>
      </ul>
    </aside>
  );
}

export default function RegisterPage() {
  useDocumentTitle('Create an account');
  const { user, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const nextPath = safeNext(params.get('next'));
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '', agree: false });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  if (user) return <Navigate to={dashboardHome(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.full_name.trim().length < 2) next.full_name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    // phone is optional, but if given it must be kenyan
    if (form.phone.trim() && !isKenyanPhone(form.phone)) next.phone = PHONE_ERROR;
    if (form.password.length < 8 || !/\d/.test(form.password) || !/[a-z]/i.test(form.password)) next.password = 'Use at least 8 characters, including letters and a number.';
    else if (new TextEncoder().encode(form.password).length > 72) next.password = 'Use 72 characters or fewer.';
    if (form.confirm !== form.password) next.confirm = 'The passwords do not match.';
    if (!form.agree) next.agree = 'Please accept the terms and privacy notice.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      const created = await register({ full_name: form.full_name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, password: form.password });
      toast(`Welcome to ReproCare, ${created.full_name.split(' ')[0]}.`);
      navigate(nextPath || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      setErrors(err.fields || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthSwitch active="register" next={nextPath} />
        <h1>Create your free account</h1>
        <p className="muted">You can search and read without an account. An account lets you save, request and register.</p>
        <form className="stack" onSubmit={submit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextInput label="Full name" autoComplete="name" autoFocus value={form.full_name} onChange={set('full_name')} error={errors.full_name} required />
          <TextInput label="Email address" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} required />
          <TextInput label="Phone number" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="Optional. A Kenyan number, e.g. 0712 345 678. You can sign in with it, and it pre-fills appointment and registration forms." />
          <div>
            <PasswordInput label="Password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="At least 8 characters, with letters and a number" required />
            <StrengthMeter value={form.password} />
          </div>
          <PasswordInput label="Confirm password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} required />
          <Checkbox checked={form.agree} onChange={set('agree')} label={<>I accept the <Link to="/terms">terms of use</Link> and have read the <Link to="/privacy">privacy notice</Link>.</>} />
          {errors.agree && <span className="field-error">{errors.agree}</span>}
          <button className="btn btn-primary btn-lg btn-block" disabled={busy} aria-busy={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <div className="auth-foot">
          <p className="small">
            Already have an account? <Link to={`/sign-in${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ''}`}>Sign in</Link>
          </p>
          <p className="small muted">Your password is stored as a salted hash; ReproCare staff can never see it.</p>
        </div>
      </div>
      <AuthAside />
    </div>
  );
}