import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Search } from "lucide-react";
import { api } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate } from "../data/labels";
import { Breadcrumbs } from "../components/PageHeader";
import { ErrorState, LoadingState } from "../components/Feedback";
import NotFoundPage from "./NotFoundPage";

export default function ArticlePage() {
  const { slug } = useParams();
  const result = useFetch(() => api.article(slug), [slug]);
  const services = useFetch(() => api.services(), []);
  const all = useFetch(() => api.articles(), []);
  const a = result.data;
  useDocumentTitle(a?.title, a?.summary);

  if (result.error?.status === 404) return <NotFoundPage what="article" />;
  if (result.error)
    return (
      <div className="container section">
        <ErrorState error={result.error} onRetry={result.reload} />
      </div>
    );
  if (!a)
    return (
      <div className="container section">
        <LoadingState rows={3} />
      </div>
    );
  const related = (all.data || [])
    .filter(
      (x) =>
        x.slug !== a.slug &&
        (x.category === a.category ||
          x.related_services.some((s) => a.related_services.includes(s))),
    )
    .slice(0, 3);
  const serviceNames = (services.data || []).filter((s) =>
    a.related_services.includes(s.slug),
  );

  return (
    <div className="container article-layout">
      <article className="article">
        <Breadcrumbs
          items={[
            { label: "Health library", to: "/health-library" },
            { label: a.title },
          ]}
        />
        <p className="article-category">{a.category}</p>
        <h1>{a.title}</h1>
        <p className="lede">{a.summary}</p>
        <p className="small muted">
          {a.read_minutes} min read · Updated {formatDate(a.updated_on)} ·{" "}
          {a.review_status}
        </p>
        <div className="alert alert-info" style={{ margin: "24px 0" }}>
          <AlertTriangle size={18} aria-hidden="true" />
          <p>
            General information, not a diagnosis or treatment plan. For advice
            about your own health, speak with a qualified health worker.
          </p>
        </div>
        {a.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {(section.paragraphs || []).map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((li) => (
                  <li key={li}>{li}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        {a.questions_to_ask.length > 0 && (
          <section className="questions-box">
            <h2>Questions to ask at your visit</h2>
            <ul>
              {a.questions_to_ask.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </section>
        )}
        {a.references.length > 0 && (
          <section>
            <h2>Sources</h2>
            <ul className="small">
              {a.references.map((r) => (
                <li key={r.label}>
                  {r.label}, {r.publisher}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <aside className="article-aside">
        {serviceNames.length > 0 && (
          <section className="panel">
            <h2>Find this care</h2>
            <ul className="plain-links">
              {serviceNames.map((s) => (
                <li key={s.slug}>
                  <Link to={`/find-care/facilities?service=${s.slug}`}>
                    <Search size={14} aria-hidden="true" /> {s.name} near you
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        {related.length > 0 && (
          <section className="panel">
            <h2>Related guides</h2>
            <ul className="plain-links">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link to={`/health-library/${r.slug}`}>{r.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="panel">
          <h2>Have a question?</h2>
          <p className="small">
            The assistant answers general questions from these guides in English
            or Kiswahili.
          </p>
          <Link to="/assistant" className="btn btn-secondary btn-sm">
            Ask the assistant
          </Link>
        </section>
      </aside>
    </div>
  );
}
