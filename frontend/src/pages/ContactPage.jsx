import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Mail, MessageCircle, Phone } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { contactTopics } from "../data/labels";
import { PageHeader } from "../components/PageHeader";
import { Select, TextArea, TextInput } from "../components/Forms";
import { Alert } from "../components/Feedback";

export default function ContactPage() {
  useDocumentTitle(
    "Contact us",
    "Contact ReproCare with questions, listing corrections, privacy requests or feedback.",
  );
  const { user } = useAuth();
  const [params] = useSearchParams();
  const facility = params.get("facility");
  const [form, setForm] = useState({
    name: user?.full_name || "",
    email: user?.email || "",
    topic:
      params.get("topic") in contactTopics ? params.get("topic") : "general",
    message: facility ? `About the listing "${facility}": ` : "",
    website: "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // The signed-in user may load after the page first renders; fill empty fields once it does.
  useEffect(() => {
    if (user)
      setForm((f) => ({
        ...f,
        name: f.name || user.full_name,
        email: f.email || user.email,
      }));
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim()))
      next.email =
        "Enter an email address we can reply to, e.g. name@example.com.";
    if (form.message.trim().length < 10)
      next.message = "Tell us a little more (at least 10 characters).";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSending(true);
    setError(null);
    try {
      setSent(
        await api.contact({
          ...form,
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        }),
      );
    } catch (err) {
      setError(err.message);
      setErrors(err.fields || {});
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Contact us"
        intro="Questions about using ReproCare, corrections to a listing, privacy requests and feedback all reach the same team."
        crumbs={[
          { label: "About ReproCare", to: "/about" },
          { label: "Contact us" },
        ]}
      />
      <div className="container contact-layout section-sm">
        <section className="panel">
          {sent ? (
            <div className="confirmation" role="status">
              <CheckCircle2
                size={36}
                color="var(--green-600)"
                aria-hidden="true"
              />
              <div>
                <h2>Message received</h2>
                <p>
                  Your reference is <strong>{sent.reference}</strong>. We reply
                  by email, usually within two working days. Keep the reference
                  if you need to follow up.
                </p>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSent(null);
                    setForm({ ...form, message: "" });
                  }}
                >
                  Send another message
                </button>
              </div>
            </div>
          ) : (
            <form className="form-grid" onSubmit={submit} noValidate>
              <h2 className="span-2">Send a message</h2>
              {error && (
                <div className="span-2">
                  <Alert tone="danger">{error}</Alert>
                </div>
              )}
              <TextInput
                label="Your name"
                value={form.name}
                onChange={set("name")}
                error={errors.name}
                autoComplete="name"
                required
              />
              <TextInput
                label="Email address"
                type="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
                autoComplete="email"
                required
              />
              <Select
                className="span-2"
                label="What is it about?"
                value={form.topic}
                onChange={set("topic")}
                options={Object.entries(contactTopics).map(
                  ([value, label]) => ({ value, label }),
                )}
              />
              <TextArea
                className="span-2"
                label="Message"
                value={form.message}
                onChange={set("message")}
                error={errors.message}
                rows={6}
                maxLength={4000}
                hint="Please do not include medical details. We cannot give medical advice by message."
                required
              />
              <div className="hp-field" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={set("website")}
                />
              </div>
              <div className="span-2 row">
                <button className="btn btn-primary btn-lg" disabled={sending}>
                  {sending ? "Sending…" : "Send message"}
                </button>
                <span className="small muted">
                  We use your details only to reply to this message.
                </span>
              </div>
            </form>
          )}
        </section>
        <aside className="stack">
          <section className="panel emergency-panel">
            <Phone size={20} aria-hidden="true" />
            <h2>Need urgent help?</h2>
            <p className="small">
              ReproCare cannot respond to emergencies. Call{" "}
              <a href="tel:999">999</a> or <a href="tel:112">112</a>, or go to
              the nearest health facility.
            </p>
          </section>
          <section className="panel">
            <h2>Other ways to get answers</h2>
            <ul className="contact-list">
              <li>
                <MessageCircle size={16} aria-hidden="true" />{" "}
                <Link to="/assistant">Ask the health assistant</Link> general
                questions
              </li>
              <li>
                <Mail size={16} aria-hidden="true" /> Facility details? Contact
                the facility using the number on its listing
              </li>
              <li>
                <Clock size={16} aria-hidden="true" /> We reply Monday to
                Friday, 8 am to 5 pm (EAT)
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
