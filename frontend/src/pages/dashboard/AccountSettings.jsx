import { useState } from "react";
import { api, setToken } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { roleLabels } from "../../data/navigation";
import { DashboardHeader } from "../../components/DashboardParts";
import {
  Checkbox,
  isKenyanPhone,
  PasswordInput,
  PHONE_ERROR,
  StrengthMeter,
  TextInput,
} from "../../components/Forms";
import { Alert } from "../../components/Feedback";
import { useToast } from "../../components/Toast";
import { useSignOut } from "../../components/UserMenu";
import { useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, Trash2 } from "lucide-react";

export default function AccountSettings() {
  useDocumentTitle("Account settings");
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({
    full_name: user.full_name,
    phone: user.phone || "",
  });
  const [pw, setPw] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [errors, setErrors] = useState({});
  const [pwError, setPwError] = useState(null);
  const [busy, setBusy] = useState(null); // 'profile' | 'password' | 'everywhere' | 'delete'
  const [removal, setRemoval] = useState({ password: "", understood: false });
  const [removalError, setRemovalError] = useState(null);
  const doSignOut = useSignOut();
  const navigate = useNavigate();
  const dirty =
    profile.full_name !== user.full_name ||
    profile.phone !== (user.phone || "");

  const saveProfile = async (e) => {
    e.preventDefault();
    if (profile.full_name.trim().length < 2)
      return setErrors({ full_name: "Enter your full name." });
    // phone is optional, but if given it must be kenyan
    if (profile.phone.trim() && !isKenyanPhone(profile.phone))
      return setErrors({ phone: PHONE_ERROR });
    setErrors({});
    setBusy("profile");
    try {
      setUser(
        await api.updateMe({
          full_name: profile.full_name.trim(),
          phone: profile.phone.trim() || null,
        }),
      );
      toast("Profile updated");
    } catch (err) {
      setErrors(err.fields || {});
      toast(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError(null);
    if (!pw.current_password) return setPwError("Enter your current password.");
    if (
      pw.new_password.length < 8 ||
      !/\d/.test(pw.new_password) ||
      !/[a-z]/i.test(pw.new_password)
    )
      return setPwError(
        "Use at least 8 characters, including letters and a number.",
      );
    if (pw.new_password !== pw.confirm)
      return setPwError("The new passwords do not match.");
    setBusy("password");
    try {
      await api.changePassword({
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: "", new_password: "", confirm: "" });
      toast("Password changed. Other devices have been signed out.");
    } catch (err) {
      setPwError(err.fields?.new_password || err.message);
    } finally {
      setBusy(null);
    }
  };

  // delete account: needs the password and the "I understand" tick
  const deleteAccount = async (e) => {
    e.preventDefault();
    if (!removal.password)
      return setRemovalError("Enter your password to confirm.");
    if (!removal.understood)
      return setRemovalError(
        "Tick the box to confirm you understand this cannot be undone.",
      );
    setRemovalError(null);
    setBusy("delete");
    try {
      await api.deleteAccount(removal.password);
      setToken(null);
      window.dispatchEvent(new Event("reprocare:signed-out"));
      navigate("/", { replace: true });
      toast("Your account has been deleted.");
    } catch (err) {
      setRemovalError(err.message);
      setRemoval((r) => ({ ...r, password: "" }));
      setBusy(null);
    }
  };

  const signOutEverywhere = async () => {
    setBusy("everywhere");
    try {
      await api.logoutAll();
    } catch {
      /* the session may already have ended */
    }
    setToken(null);
    window.dispatchEvent(new Event("reprocare:signed-out"));
    navigate("/sign-in", { replace: true });
    toast("Signed out on all devices.");
  };

  return (
    <>
      <DashboardHeader
        title="Account settings"
        description="Your contact details, password and signed-in devices."
      />
      <div className="dash-grid two">
        <form className="panel stack" onSubmit={saveProfile} noValidate>
          <h2>Profile</h2>
          <TextInput
            label="Full name"
            value={profile.full_name}
            onChange={(e) =>
              setProfile({ ...profile, full_name: e.target.value })
            }
            error={errors.full_name}
            required
          />
          <TextInput
            label="Email address"
            value={user.email}
            disabled
            hint="Contact support to change your email address."
          />
          <TextInput
            label="Phone number"
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            error={errors.phone}
            hint="Optional. A Kenyan number, e.g. 0712 345 678. You can sign in with it, and it pre-fills appointment and registration forms."
          />
          <p className="small muted">
            Account type: {roleLabels[user.role]}
            {user.facility ? `, ${user.facility.name}` : ""}
          </p>
          <button
            className="btn btn-primary"
            disabled={!dirty || busy === "profile"}
          >
            {busy === "profile" ? "Saving…" : "Save changes"}
          </button>
        </form>
        <form className="panel stack" onSubmit={changePassword} noValidate>
          <h2>Change password</h2>
          {pwError && <Alert tone="danger">{pwError}</Alert>}
          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={pw.current_password}
            onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
            required
          />
          <div>
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              value={pw.new_password}
              onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
              hint="At least 8 characters, including a number."
              required
            />
            <StrengthMeter value={pw.new_password} />
          </div>
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            required
          />
          <button className="btn btn-secondary" disabled={busy === "password"}>
            {busy === "password" ? "Updating…" : "Change password"}
          </button>
        </form>
      </div>
      <section className="panel stack" style={{ marginTop: 20 }}>
        <h2 className="row" style={{ gap: 8 }}>
          <ShieldCheck size={20} aria-hidden="true" /> Sessions
        </h2>
        <p className="small muted">
          Signed in on a shared or lost device? Sign out everywhere and sign in
          again on this one.
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={doSignOut}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
          <button
            className="btn btn-danger"
            onClick={signOutEverywhere}
            disabled={busy === "everywhere"}
          >
            {busy === "everywhere" ? "Signing out…" : "Sign out on all devices"}
          </button>
        </div>
      </section>
      <section
        className="panel stack danger-zone"
        style={{ marginTop: 20 }}
        aria-labelledby="delete-account"
      >
        <h2 id="delete-account" className="row" style={{ gap: 8 }}>
          <Trash2 size={20} aria-hidden="true" /> Delete my account
        </h2>
        {user.role === "admin" ? (
          <p className="small muted">
            Administrator accounts cannot be deleted here. Ask another
            administrator to remove this account.
          </p>
        ) : (
          <form className="stack" onSubmit={deleteAccount} noValidate>
            <p className="small">
              This permanently removes your name, email address and phone number
              from ReproCare and signs you out everywhere.
            </p>
            <ul className="small">
              <li>
                Pending appointment requests and upcoming confirmed appointments
                are cancelled, and the facility is told.
              </li>
              <li>Programme registrations are cancelled.</li>
              <li>
                Your published reviews stay, shown as written by “Former
                member”.
              </li>
              <li>Saved facilities and notifications are deleted.</li>
            </ul>
            {removalError && <Alert tone="danger">{removalError}</Alert>}
            <PasswordInput
              label="Your password"
              autoComplete="current-password"
              value={removal.password}
              onChange={(e) =>
                setRemoval({ ...removal, password: e.target.value })
              }
              required
            />
            <Checkbox
              checked={removal.understood}
              onChange={(e) =>
                setRemoval({ ...removal, understood: e.target.checked })
              }
              label="I understand that this cannot be undone."
            />
            <div>
              <button
                className="btn btn-danger"
                disabled={busy === "delete"}
                aria-busy={busy === "delete"}
              >
                {busy === "delete" ? "Deleting…" : "Delete my account"}
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
