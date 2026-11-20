import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Clock } from "lucide-react";
import { api } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";

export default function LibraryPage() {
  useDocumentTitle(
    "Health library",
    "Clear, sourced guides on antenatal care, contraception, screening, fertility and visiting a facility in Kenya.",
  );
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const all = useFetch(() => api.articles(), []);
  const results = useFetch(() => api.articles({ q, category }), [q, category]);
  const categories = [
    ...new Set((all.data || []).map((a) => a.category)),
  ].sort();
  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next);
  };

  return (
    <>
      <PageHeader
        title="Health library"
        intro="Plain-language guides to common reproductive health questions: what to expect, what to bring and what to ask. They are general information and do not replace advice from a health worker who knows you."
        crumbs={[
          { label: "Health & community", to: "/health-community/programmes" },
          { label: "Health library" },
        ]}
      >
        <form
          className="inline-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            set("q", new FormData(e.currentTarget).get("q"));
          }}
        >
          <label className="sr-only" htmlFor="lib-q">
            Search the library
          </label>
          <input
            id="lib-q"
            name="q"
            className="input"
            defaultValue={q}
            placeholder="e.g. screening, contraception"
          />
          <button className="btn btn-primary">Search</button>
        </form>
      </PageHeader>
      <div className="container section-sm">
        <div className="chip-row" role="group" aria-label="Categories">
          <button
            className="chip"
            aria-pressed={!category}
            onClick={() => set("category", "")}
          >
            All topics
          </button>
          {categories.map((c) => (
            <button
              key={c}
              className="chip"
              aria-pressed={category === c}
              onClick={() => set("category", c)}
            >
              {c}
            </button>
          ))}
        </div>
        {results.loading && <LoadingState rows={2} height={160} />}
        {results.error && (
          <ErrorState error={results.error} onRetry={results.reload} />
        )}
        {results.data?.length === 0 && (
          <EmptyState
            icon={<BookOpen size={26} />}
            title="No guides match that search"
          >
            Try a simpler word, or ask the health assistant.
          </EmptyState>
        )}
        <div className="article-grid">
          {(results.data || []).map((a) => (
            <article key={a.slug} className="article-card">
              <p className="article-category">{a.category}</p>
              <h2>
                <Link to={`/health-library/${a.slug}`}>{a.title}</Link>
              </h2>
              <p>{a.summary}</p>
              <p className="small muted row" style={{ gap: 6, margin: 0 }}>
                <Clock size={14} aria-hidden="true" /> {a.read_minutes} min read
              </p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}
