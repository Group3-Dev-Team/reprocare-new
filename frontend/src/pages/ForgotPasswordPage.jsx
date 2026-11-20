import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { api, isDemoMode } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { isKenyanPhone, TextInput } from '../components/Forms';
import { Alert } from '../components/Feedback';
import { AuthAside } from './RegisterPage';

/** forgot password: ask for email or phone. the reply never says if the account exists */
export default function ForgotPasswordPage() {
  useDocumentTitle('Reset your password');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const id = identifier.trim();
    if (!/^\S+@\S+\.\S+$/.test(id) && !isKenyanPhone(id)) {
      setFieldError('Enter your email address, or the Kenyan phone number on your account (e.g. 0712 345 678).');
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      setSent((await api.forgotPassword(id)).message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Reset your password</h1>
        {sent ? (
          <div className="stack" role="status">
            <div className="confirmation">
              <MailCheck size={36} color="var(--green-600)" aria-hidden="true" />
              <p>{sent}</p>
            </div>
            <p className="small muted">Not received it after a few minutes? Check your spam folder, or try again with the other detail on your account.</p>
            {isDemoMode && <Alert tone="info">Preview build: no email is sent. The reset link is printed in the browser’s developer console.</Alert>}
            <div className="row">
              <Link className="btn btn-primary" to="/sign-in">Back to sign in</Link>
              <button type="button" className="btn btn-ghost" onClick={() => setSent(null)}>Try again</button>
            </div>
          </div>
        ) : (
          <>
            <p className="muted">Enter the email address or phone number on your account. We will email you a link to choose a new password.</p>
            <form className="stack" onSubmit={submit} noValidate>
              {error && <Alert tone="danger">{error}</Alert>}
              <TextInput
                label="Email or phone number"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                error={fieldError}
                required
              />
              <button className="btn btn-primary btn-lg btn-block" disabled={busy} aria-busy={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <div className="auth-foot">
              <p className="small">
                Remembered it? <Link to="/sign-in">Sign in</Link>
              </p>
              <p className="small muted">No access to that email any more? <Link to="/contact?topic=technical">Contact us</Link>.</p>
            </div>
          </>
        )}
      </div>
      <AuthAside />
    </div>
  );
}