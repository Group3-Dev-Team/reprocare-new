import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { api, setToken } from "../services/api";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { PasswordInput, StrengthMeter } from "../components/Forms";
import { Alert } from "../components/Feedback";
import { AuthAside } from "./RegisterPage";

const strongEnough = (p) =>
  p.length >= 8 &&
  /\d/.test(p) &&
  /[a-z]/i.test(p) &&
  new TextEncoder().encode(p).length <= 72;

/** opened from the reset email link: /reset-password?token=... */
export default function ResetPasswordPage() {
  useDocumentTitle("Choose a new password");
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!strongEnough(form.password))
      next.password = "Use 8 to 72 characters, including letters and a number.";
    if (form.confirm !== form.password)
      next.confirm = "The passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, form.password);
      // all sessions ended, so sign out in this browser too
      setToken(null);
      window.dispatchEvent(new Event("reprocare:signed-out"));
      setDone(true);
    } catch (err) {
      setError(err.message);
      if (err.fields?.new_password)
        setErrors({ password: err.fields.new_password });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Choose a new password</h1>
        {!token ? (
          <div className="stack">
            <Alert tone="danger">
              This page needs the link from your reset email. Open the link
              again, or request a new one.
            </Alert>
            <Link className="btn btn-primary" to="/forgot-password">
              Request a reset link
            </Link>
          </div>
        ) : done ? (
          <div className="stack" role="status">
            <div className="confirmation">
              <CheckCircle2
                size={36}
                color="var(--green-600)"
                aria-hidden="true"
              />
              <p>
                Your password has been changed and you have been signed out on
                every device. Sign in with your new password.
              </p>
            </div>
            <Link className="btn btn-primary" to="/sign-in">
              Sign in
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit} noValidate>
            {error && (
              <Alert tone="danger">
                {error}{" "}
                {/expired|used|invalid/i.test(error) && (
                  <Link to="/forgot-password">Request a new link</Link>
                )}
              </Alert>
            )}
            <div>
              <PasswordInput
                label="New password"
                autoComplete="new-password"
                autoFocus
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                error={errors.password}
                hint="At least 8 characters, with letters and a number"
                required
              />
              <StrengthMeter value={form.password} />
            </div>
            <PasswordInput
              label="Confirm new password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              error={errors.confirm}
              required
            />
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
            <p className="small muted">
              Changing your password signs you out on every device.
            </p>
          </form>
        )}
      </div>
      <AuthAside />
    </div>
  );
}
