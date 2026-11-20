import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bot,
  ShieldCheck,
  Trophy,
  Facebook,
  SearchX,
} from "lucide-react";
import doctor from "../assets/doctor.jpg";
import facility from "../assets/facility.jpg";
import { clinicById } from "../data/clinics";
import { go, href } from "../lib/router";
import { useStore } from "../lib/store";
import { useResults } from "../lib/useResults";
import { defaultFilters } from "../lib/search";
import {
  ActiveFilters,
  CompareBar,
  DetailsDrawer,
  DetailsPanel,
  FilterBar,
  ResultRow,
  SearchBar,
  SortControl,
} from "../components/Workspace";
import { FamilyCard } from "../components/FamilyCard";
import { OutreachStrip } from "../components/Outreach";
import { Button, EmptyState } from "../components/ui";

export function Home() {
  const { selectedId, setSelectedId, setPendingQuestion, setFilters, filters } =
    useStore();
  const { results, total, origin } = useResults({ page: 1, pageSize: 3 });
  const [drawer, setDrawer] = useState(false);
  const openDrawer = useCallback(() => setDrawer(true), []);
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const [ask, setAsk] = useState("");
  const top = results;
  useEffect(() => {
    if (!selectedId || !results.some((r) => r.clinic.id === selectedId))
      setSelectedId(results[0]?.clinic.id ?? null);
  }, [results]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitAsk = (e) => {
    e.preventDefault();
    setPendingQuestion(
      ask.trim() ||
        "What should I expect during my first fertility consultation?",
    );
    go(href.assistant);
  };
  return (
    <div className="dash">
      <section className="ref-hero" aria-labelledby="hero-title">
        <div className="ref-hero-art" aria-hidden="true">
          <img className="ref-hero-bg" src={facility} alt="" />
          <img className="ref-hero-doc" src={doctor} alt="" />
        </div>
        <p className="ref-hero-script" aria-hidden="true">
          Better care.
          <br />
          Brighter future.
          <svg viewBox="0 0 200 20" preserveAspectRatio="none">
            <path
              d="M4 16 C 60 4, 140 2, 196 10"
              stroke="var(--green)"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </p>
        <div className="ref-hero-copy">
          <h1 id="hero-title">
            <span>Find care that</span>{" "}
            <span className="h-green">fits your needs</span>
          </h1>
          <p>
            Search healthcare services, compare practical provider information
            and decide who to contact. Check each source and confirm service
            arrangements with the provider.
          </p>
          <SearchBar onSearch={() => setSelectedId(null)} />
          <FilterBar />
          <ActiveFilters />
        </div>
        <span className="sr-only">
          Photo: a smiling female health professional in a white coat outside a
          hospital.
        </span>
      </section>

      <div className="dash-grid">
        <section className="dash-results" aria-labelledby="top-title">
          <div className="dash-results-head">
            <h2 id="top-title">
              <Trophy size={26} aria-hidden="true" className="trophy" />
              {filters.query || filters.service
                ? "Best matching facilities"
                : "Facilities near you"}{" "}
              <span className="count">
                ({total} {total === 1 ? "result" : "results"})
              </span>
            </h2>
            <div className="head-actions">
              <SortControl />
              <a className="text-link" href={href.find}>
                View all and map
              </a>
            </div>
          </div>
          {top.length ? (
            <div className="rrows">
              {top.map((r, i) => (
                <ResultRow
                  key={r.clinic.id}
                  result={r}
                  index={i}
                  origin={origin}
                  selected={selectedId === r.clinic.id}
                  onSelect={setSelectedId}
                  onOpen={openDrawer}
                  badge={!!(filters.query || filters.service)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<SearchX size={28} />}
              title="No providers match all of these filters"
              action={
                <Button
                  variant="secondary"
                  onClick={() => setFilters(defaultFilters)}
                >
                  Clear search and filters
                </Button>
              }
            >
              Remove a filter or choose another location.
            </EmptyState>
          )}
          {total > 3 && (
            <a
              className="btn btn-secondary btn-md more-results"
              href={href.find}
            >
              <span>See all {total} facilities</span>
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
        </section>
        <DetailsPanel
          clinic={selectedId ? clinicById(selectedId) : undefined}
        />
      </div>
      <DetailsDrawer
        clinic={selectedId ? clinicById(selectedId) : undefined}
        open={drawer}
        onClose={closeDrawer}
      />
      <CompareBar />

      <OutreachStrip />

      <section
        className="home-family"
        aria-label="For families, providers and partners"
      >
        <FamilyCard />
        <div className="home-roles">
          <a className="panel overview-card" href={href.listFacility}>
            <strong>Run a hospital, clinic or laboratory?</strong>
            <span>
              Claim or register your facility and keep its listing accurate.
            </span>
          </a>
          <a className="panel overview-card" href={href.joinPractitioner}>
            <strong>Independent healthcare practitioner?</strong>
            <span>
              Create your professional profile, list your services and manage
              enquiries.
            </span>
          </a>
          <a className="panel overview-card" href={href.partner}>
            <strong>Insurer, diagnostic service or sponsor?</strong>
            <span>Partner with ReproCare under a written agreement.</span>
          </a>
          <a className="panel overview-card" href={href.freeCare}>
            <strong>Looking for free or subsidised care?</strong>
            <span>
              Find screenings and community health programmes near you.
            </span>
          </a>
        </div>
      </section>

      <section className="dash-strip" aria-label="More help">
        <form className="strip-ask" onSubmit={submitAsk}>
          <span className="strip-bot" aria-hidden="true">
            <Bot size={28} />
          </span>
          <div className="strip-ask-text">
            <h2>Ask the ReproCare assistant</h2>
            <p>General answers in English or Kiswahili.</p>
          </div>
          <label className="strip-ask-input">
            <span className="sr-only">Your question</span>
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="e.g. What should I expect during a fertility consultation?"
            />
            <button type="submit" aria-label="Ask the assistant">
              <ArrowRight size={18} />
            </button>
          </label>
        </form>
        <div className="strip-sources">
          <h2>Where patient experiences come from</h2>
          <div
            className="strip-logos"
            aria-label="ReproCare, Google and Facebook"
          >
            <span className="lg rc" title="Moderated ReproCare reviews">
              <ShieldCheck size={20} />
            </span>
            <span className="lg g" title="Google ratings">
              G
            </span>
            <span
              className="lg fb"
              title="Facebook recommendations, with the facility’s permission"
            >
              <Facebook size={20} />
            </span>
          </div>
          <a className="small" href={href.trust}>
            How we label sources
          </a>
        </div>
        <div className="strip-privacy">
          <ShieldCheck size={36} aria-hidden="true" />
          <div>
            <h2>Your privacy matters</h2>
            <p>
              Browsing needs no account. Questions are never shared with
              clinics.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
