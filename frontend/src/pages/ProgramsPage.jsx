import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HandHeart, List, Map as MapIcon } from "lucide-react";
import { api } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { costTypes, programTypes } from "../data/labels";
import { PageHeader } from "../components/PageHeader";
import { ProgramCard } from "../components/ProgramCard";
import { MapView } from "../components/MapView";
import { Pagination } from "../components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/Feedback";

const copy = {
  free: {
    title: "Free & subsidised care",
    intro:
      "Free screening days, testing weekends and reduced-fee clinics run by facilities and community health teams. Register ahead to hold a place.",
    crumb: "Free & subsidised care",
  },
  all: {
    title: "Community health programmes",
    intro:
      "Outreach events, education sessions and screening days across Kenya. Each listing shows eligibility, what to bring and how many places are left.",
    crumb: "Community programmes",
  },
};

export default function ProgramsPage({ variant }) {
  const text = copy[variant];
  useDocumentTitle(text.title, text.intro);
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState("list");
  const services = useFetch(() => api.services(), []);
  const towns = useFetch(() => api.towns(), []);
  const page = Number(params.get("page") || 1);
  const query = { ...Object.fromEntries(params.entries()) };
  if (variant === "free" && !query.cost_type)
    query.cost_type = "free,subsidised";
  const key = `${variant}|${params.toString()}`;
  const results = useFetch(
    () => api.programs({ ...query, page, page_size: 15 }),
    [key],
  );
  const mapData = useFetch(
    () =>
      view === "map"
        ? api.programs({ ...query, page: 1, page_size: 40 })
        : Promise.resolve(null),
    [key, view],
  );

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) =>
      v ? next.set(k, String(v)) : next.delete(k),
    );
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };
  const data = results.data;
  const points = useMemo(
    () =>
      (mapData.data?.items || []).map((p) => ({
        id: p.slug,
        name: p.title,
        latitude: p.latitude,
        longitude: p.longitude,
        subtitle: `${p.town} · ${p.start_date}`,
        href: `/programmes/${p.slug}`,
        demo: p.is_demo,
      })),
    [mapData.data],
  );

  return (
    <>
      <PageHeader
        title={text.title}
        intro={text.intro}
        crumbs={[
          { label: "Health & community", to: "/health-community/programmes" },
          { label: text.crumb },
        ]}
        tone="green"
      />
      <div className="container section-sm">
        <div className="filter-row">
          <form
            className="inline-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: new FormData(e.currentTarget).get("q") });
            }}
          >
            <label className="sr-only" htmlFor="program-q">
              Search programmes
            </label>
            <input
              id="program-q"
              name="q"
              className="input"
              defaultValue={params.get("q") || ""}
              placeholder="Search programmes or organisers"
            />
            <button className="btn btn-primary">Search</button>
          </form>
          <select
            className="select"
            aria-label="Town"
            value={params.get("town") || ""}
            onChange={(e) => update({ town: e.target.value })}
          >
            <option value="">All towns</option>
            {(towns.data || [])
              .slice()
              .sort((a, b) => a.town.localeCompare(b.town))
              .map((t) => (
                <option key={t.town}>{t.town}</option>
              ))}
          </select>
          <select
            className="select"
            aria-label="Service"
            value={params.get("service") || ""}
            onChange={(e) => update({ service: e.target.value })}
          >
            <option value="">Any service</option>
            {(services.data || []).map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Type"
            value={params.get("program_type") || ""}
            onChange={(e) => update({ program_type: e.target.value })}
          >
            <option value="">All types</option>
            {Object.entries(programTypes).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            className="select"
            aria-label="Cost"
            value={params.get("cost_type") || ""}
            onChange={(e) => update({ cost_type: e.target.value })}
          >
            <option value="">
              {variant === "free" ? "Free or subsidised" : "Any cost"}
            </option>
            {Object.entries(costTypes)
              .filter(([v]) => variant !== "free" || v !== "paid")
              .map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
          </select>
          <label className="check">
            <input
              type="checkbox"
              checked={params.get("include_past") === "true"}
              onChange={(e) => update({ include_past: e.target.checked })}
            />
            <span>Include past events</span>
          </label>
        </div>

        <div className="results-toolbar">
          <h2 className="results-count">
            {results.loading ? "Searching…" : `${data?.total ?? 0} programmes`}
          </h2>
          <div className="segmented" role="group" aria-label="View">
            <button
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <List size={16} aria-hidden="true" /> List
            </button>
            <button
              aria-pressed={view === "map"}
              onClick={() => setView("map")}
            >
              <MapIcon size={16} aria-hidden="true" /> Map
            </button>
          </div>
        </div>

        {view === "map" && (
          <div className="map-panel">
            <MapView points={points} height={420} label="Map of programmes" />
            <p className="small muted map-help">
              Showing up to 40 matching programmes with a stored venue location.
            </p>
          </div>
        )}
        {results.loading && <LoadingState rows={3} height={150} />}
        {results.error && (
          <ErrorState error={results.error} onRetry={results.reload} />
        )}
        {data?.total === 0 && (
          <EmptyState
            icon={<HandHeart size={26} />}
            title="No programmes match these filters"
            action={
              <button
                className="btn btn-primary"
                onClick={() => setParams(new URLSearchParams())}
              >
                Clear filters
              </button>
            }
          >
            New programmes are added regularly. Try another town or service, or
            include past events to see what has run before.
          </EmptyState>
        )}
        {data?.total > 0 && (
          <>
            <div className="program-list">
              {data.items.map((p) => (
                <ProgramCard key={p.slug} program={p} />
              ))}
            </div>
            <Pagination
              showSummary={false}
              page={data.page}
              pages={data.pages}
              total={data.total}
              pageSize={data.page_size}
              noun="programmes"
              onChange={(p) => update({ page: p })}
            />
          </>
        )}
      </div>
    </>
  );
}
