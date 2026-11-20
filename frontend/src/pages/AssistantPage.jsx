import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  ArrowUp,
  BookOpenText,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  personalTerms,
  scripted,
  suggestedQuestions,
  ui,
  urgentTerms,
} from "../data/assistantContent";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { PageHeader } from "../components/PageHeader";

// Short terms match whole words only, so "anc" does not match "cancer".
const has = (text, term) =>
  term.length <= 4
    ? new RegExp(`(^|[^a-z])${term}`, "i").test(text)
    : text.includes(term);

/** Choose a reviewed answer. Emergencies and personal medical questions are recognised first. */
export function respond(text) {
  const t = text.toLowerCase();
  if (urgentTerms.some((u) => t.includes(u))) return { kind: "urgent" };
  if (personalTerms.some((u) => t.includes(u))) return { kind: "personal" };
  const hit = scripted.find((s) => s.match.some((m) => has(t, m)));
  return hit ? { kind: "answer", id: hit.id } : { kind: "unknown" };
}

export default function AssistantPage() {
  useDocumentTitle(
    "Health assistant",
    "General answers to common reproductive health questions in English or Kiswahili, from ReproCare’s reviewed guides.",
  );
  const [lang, setLang] = useState("en");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const end = useRef(null);
  const L = ui[lang];

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

  const ask = (question) => {
    const q = question.trim();
    if (!q) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: q },
      { role: "bot", ...respond(q) },
    ]);
    setText("");
  };

  return (
    <>
      <PageHeader
        title="Health assistant"
        intro="General answers to common questions about pregnancy care, contraception, testing and screening, in English or Kiswahili. Answers come from ReproCare’s guides; no AI model is used and nothing you type is shared with clinics."
        crumbs={[
          { label: "Health & community", to: "/health-community/programmes" },
          { label: "Health assistant" },
        ]}
      />
      <div className="container assistant-layout section-sm">
        <section className="chat panel" aria-label="Conversation">
          <div className="chat-head spread">
            <div className="segmented" role="group" aria-label="Language">
              <button
                aria-pressed={lang === "en"}
                onClick={() => setLang("en")}
              >
                English
              </button>
              <button
                aria-pressed={lang === "sw"}
                onClick={() => setLang("sw")}
              >
                Kiswahili
              </button>
            </div>
            {messages.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setMessages([])}
              >
                <RotateCcw size={15} aria-hidden="true" /> {L.newChat}
              </button>
            )}
          </div>
          <div className="chat-log" aria-live="polite">
            {messages.length === 0 && (
              <div className="chat-empty">
                <h2>{L.what}</h2>
                <p className="muted">{L.try}</p>
                <ul className="suggestions">
                  {suggestedQuestions[lang].map((q) => (
                    <li key={q}>
                      <button className="chip" onClick={() => ask(q)}>
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) =>
              m.role === "user" ? (
                <p key={i} className="bubble bubble-user">
                  {m.text}
                </p>
              ) : (
                <BotMessage key={i} message={m} lang={lang} />
              ),
            )}
            <div ref={end} />
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <label className="sr-only" htmlFor="chat-q">
              Your question
            </label>
            <input
              id="chat-q"
              className="input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={L.placeholder}
              maxLength={300}
            />
            <button
              className="btn btn-primary"
              aria-label="Send question"
              disabled={!text.trim()}
            >
              <ArrowUp size={18} />
            </button>
          </form>
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            {L.privacy}
          </p>
        </section>
        <aside className="stack">
          <section className="panel">
            <h2>{L.boundaries}</h2>
            <ul className="small">
              <li>{L.b1}</li>
              <li>{L.b2}</li>
              <li>{L.b3}</li>
            </ul>
          </section>
          <section className="panel">
            <ShieldCheck
              size={22}
              color="var(--green-600)"
              aria-hidden="true"
            />
            <p className="small" style={{ marginTop: 8 }}>
              {L.mode}
            </p>
          </section>
          <section className="panel emergency-panel">
            <AlertOctagon size={22} aria-hidden="true" />
            <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
              Heavy bleeding, severe pain, fits or a baby not moving? Call{" "}
              <a href="tel:999">999</a> or <a href="tel:112">112</a>, or go to
              the nearest emergency department.
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}

function BotMessage({ message, lang }) {
  const L = ui[lang];
  if (message.kind === "urgent") {
    return (
      <div className="bubble bubble-urgent" role="alert">
        <strong>
          <AlertOctagon size={16} aria-hidden="true" /> {L.urgentT}
        </strong>
        <p>
          {L.urgentB} <a href="tel:999">999</a> / <a href="tel:112">112</a>
        </p>
        <p className="small">{L.urgentS}</p>
      </div>
    );
  }
  if (message.kind !== "answer") {
    return (
      <div className="bubble bubble-bot">
        <p>{message.kind === "personal" ? L.personal : L.unknown}</p>
        <Link to="/find-care/facilities" className="btn btn-secondary btn-sm">
          <Search size={14} aria-hidden="true" /> {L.find}
        </Link>
      </div>
    );
  }
  const a = scripted.find((s) => s.id === message.id);
  return (
    <div className="bubble bubble-bot">
      {a.paragraphs[lang].map((p) => (
        <p key={p}>{p}</p>
      ))}
      {a.bullets?.[lang] && (
        <ul>
          {a.bullets[lang].map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {a.uncertainty?.[lang] && (
        <p className="small muted">{a.uncertainty[lang]}</p>
      )}
      {a.sources?.length > 0 && (
        <ul className="bubble-sources">
          {a.sources.map((s) => (
            <li key={s.title}>
              <BookOpenText size={13} aria-hidden="true" />{" "}
              {s.articleId ? (
                <Link to={`/health-library/${s.articleId}`}>{s.title}</Link>
              ) : (
                s.title
              )}{" "}
              <span className="muted">({s.publisher})</span>
            </li>
          ))}
        </ul>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        {a.serviceId && (
          <Link
            to={`/find-care/facilities?service=${a.serviceId}`}
            className="btn btn-secondary btn-sm"
          >
            <Search size={14} aria-hidden="true" /> {L.find} {L.near}
          </Link>
        )}
        {(a.nav || []).map((n) => (
          <Link key={n.href} to={n.href} className="btn btn-ghost btn-sm">
            {n.label[lang]}
          </Link>
        ))}
      </div>
    </div>
  );
}
