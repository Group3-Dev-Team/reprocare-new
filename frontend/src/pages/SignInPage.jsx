import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { dashboardHome, useAuth } from "../hooks/useAuth";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { isKenyanPhone, PasswordInput, TextInput } from "../components/Forms";
import { Alert } from "../components/Feedback";
import { useToast } from "../components/Toast";
import { AuthAside, AuthSwitch, safeNext } from "./RegisterPage";

export default function SignInPage() {
  useDocumentTitle("Sign in");
  const { user, signIn } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get("next"));

  if (user) return <Navigate to={next || dashboardHome(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    const id = form.identifier.trim();
    // must be an email or a kenyan phone
    if (!/^\S+@\S+\.\S+$/.test(id) && !isKenyanPhone(id))
      found.identifier =
        "Enter your email address, or the Kenyan phone number on your account (e.g. 0712 345 678).";
    if (!form.password) found.password = "Enter your password.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setError(null);
    try {
      const signedIn = await signIn(id, form.password);
      toast(`Welcome back, ${signedIn.full_name.split(" ")[0]}.`);
      // Patients return to the page that asked them to sign in; staff and admins go to their workspace.
      navigate(
        next && (signedIn.role === "patient" || next.startsWith("/dashboard"))
          ? next
          : dashboardHome(signedIn),
        { replace: true },
      );
    } catch (err) {
      setError(err.message);
      setForm((f) => ({ ...f, password: "" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <AuthSwitch active="sign-in" next={next} />
        <h1>Welcome back</h1>
        <p className="muted">
          Sign in to manage appointment requests, saved facilities and programme
          registrations.
        </p>
        <form className="stack" onSubmit={submit} noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <TextInput
            label="Email or phone number"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            error={errors.identifier}
            hint="The phone number works if you added it to your account."
            required
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            error={errors.password}
            required
          />
          <div className="auth-row">
            <span />
            <Link to="/forgot-password" className="small">
              Forgot your password?
            </Link>
          </div>
          <button
            className="btn btn-primary btn-lg btn-block"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="auth-foot">
          <p className="small">
            New to ReproCare?{" "}
            <Link
              to={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            >
              Create a free account
            </Link>
          </p>
          <p className="small muted">
            Facility staff and administrators sign in with the account their
            administrator created.
          </p>
        </div>
      </div>
      <AuthAside />
    </div>
  );
}
