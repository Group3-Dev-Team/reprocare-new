import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crosshair, List, Map as MapIcon, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { facilityTypes } from '../data/labels';
import { PageHeader } from '../components/PageHeader';
import { FacilityCard } from '../components/FacilityCard';
import { MapView } from '../components/MapView';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState, Alert } from '../components/Feedback';
import { AppointmentModal } from '../components/AppointmentModal';

const PAGE_SIZE = 15;
const FLAGS = [
  ['open_weekends', 'Open at weekends'],
  ['open_24_hours', 'Open 24 hours'],
  ['telehealth', 'Offers telehealth'],
  ['accepts_requests', 'Takes appointment requests'],
  ['verified_only', 'Registry record matched'],
];

const copy = {
  facilities: {
    title: 'Hospitals & clinics',
    intro: 'Search facilities by service, town, opening hours and insurer. Each listing shows where its details come from.',
    crumb: 'Hospitals & clinics',
  },
  insurance: {
    title: 'Find care by insurer',
    intro: 'Facilities that report accepting SHA or a private insurer. Acceptance is what facilities tell us: confirm your cover with your insurer before treatment.',
    crumb: 'Care by insurer',
  },
  map: {
    title: 'Map of facilities',
    intro: 'Browse facilities on the map. Click anywhere on the map, or use your location, to list the nearest facilities first.',
    crumb: 'Facility map',
  },
};

export default function FindCarePage({ variant = 'facilities' }) {
  const text = copy[variant];
  useDocumentTitle(text.title, text.intro);
  const [params, setParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState(variant === 'map' ? 'map' : 'list');
  const [selected, setSelected] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const [locating, setLocating] = useState(null);

  const services = useFetch(() => api.services(), []);
  const insurers = useFetch(() => api.insurers(), []);
  const towns = useFetch(() => api.towns(), []);

  const filters = useMemo(() => {
    const f = Object.fromEntries(params.entries());
    if (!f.facility_type && variant !== 'map') f.exclude_laboratories = 'true';
    return f;
  }, [params, variant]);
  const page = Number(params.get('page') || 1);
  const key = params.toString();

  const results = useFetch(() => api.facilities({ ...filters, page, page_size: PAGE_SIZE }), [key]);
  const markers = useFetch(() => (view === 'map' ? api.facilityMarkers(filters) : Promise.resolve(null)), [key, view]);

  const update = useCallback(
    (changes) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([k, v]) => (v === '' || v === false || v == null ? next.delete(k) : next.set(k, String(v))));
      if (!('page' in changes)) next.delete('page');
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  const clearAll = () => setParams(new URLSearchParams());
  const moreCount = ['facility_type', ...FLAGS.map((f) => f[0])].filter((k) => params.get(k)).length;
  const [moreOpen, setMoreOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 960 || moreCount > 0);
  const activeCount = ['q', 'town', 'service', 'insurer', 'facility_type', 'lat', ...FLAGS.map((f) => f[0])].filter((k) => params.get(k)).length;

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocating('Your browser does not share location. Choose a town or click the map instead.');
      return;
    }
    setLocating('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(null);
        update({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4), sort: 'distance', town: '' });
      },
      (err) =>
        setLocating(
          err.code === 1
            ? 'Location permission was declined. Choose a town, or click the map to search near a place.'
            : 'We could not determine your location. Choose a town or click the map instead.',
        ),
      { timeout: 10000 },
    );
  };

  const onPick = useCallback(
    (lat, lng) => update({ lat: lat.toFixed(4), lng: lng.toFixed(4), sort: 'distance', town: '' }),
    [update],
  );

  const data = results.data;
  const points = useMemo(
    () =>
      (markers.data || []).map((m) => ({
        id: m.slug,
        name: m.name,
        latitude: m.latitude,
        longitude: m.longitude,
        subtitle: `${facilityTypes.find((t) => t.value === m.facility_type)?.label} · ${m.town}`,
        href: `/facilities/${m.slug}`,
      })),
    [markers.data],
  );
  const center = params.get('lat') ? [Number(params.get('lat')), Number(params.get('lng'))] : null;

  const filterPanel = (
    <aside className={`filters ${showFilters ? 'is-open' : ''}`} aria-label="Filters">
      <div className="filters-head">
        <h2>Filters</h2>
        <button className="icon-btn filters-close" aria-label="Close filters" onClick={() => setShowFilters(false)}>
          <X size={18} />
        </button>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: new FormData(e.currentTarget).get('q') });
        }}
      >
        <label className="field">
          <span className="field-label">Name, area or service</span>
          <span className="search-input">
            <Search size={17} aria-hidden="true" />
            <input className="input" name="q" type="search" enterKeyHint="search" defaultValue={params.get('q') || ''} key={params.get('q')} placeholder="e.g. Kilimani or family planning" />
            <button className="btn btn-primary btn-sm" type="submit">
              Go
            </button>
          </span>
        </label>
      </form>
      <label className="field">
        <span className="field-label">Service</span>
        <select className="select" value={params.get('service') || ''} onChange={(e) => update({ service: e.target.value })}>
          <option value="">Any service</option>
          {(services.data || []).map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Town</span>
        <select className="select" value={params.get('town') || ''} onChange={(e) => update({ town: e.target.value, lat: '', lng: '', sort: params.get('sort') === 'distance' ? '' : params.get('sort') })}>
          <option value="">All towns</option>
          {(towns.data || [])
            .slice()
            .sort((a, b) => a.town.localeCompare(b.town))
            .map((t) => (
              <option key={t.town} value={t.town}>
                {t.town} ({t.facility_count})
              </option>
            ))}
        </select>
      </label>
      <button type="button" className="btn btn-secondary btn-block" onClick={useMyLocation}>
        <Crosshair size={16} aria-hidden="true" /> Use my location
      </button>
      {locating && <p className="small muted" role="status">{locating}</p>}
      <label className="field">
        <span className="field-label">Insurer {variant === 'insurance' && <span className="badge badge-info">Start here</span>}</span>
        <select className="select" value={params.get('insurer') || ''} onChange={(e) => update({ insurer: e.target.value })}>
          <option value="">Any or none</option>
          {(insurers.data || []).map((i) => (
            <option key={i.slug} value={i.slug}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <details className="filter-more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
        <summary>
          More filters
          {moreCount > 0 && <span className="filter-more-count">{moreCount}</span>}
        </summary>
        <div className="stack">
      <label className="field">
        <span className="field-label">Facility type</span>
        <select className="select" value={params.get('facility_type') || ''} onChange={(e) => update({ facility_type: e.target.value })}>
          <option value="">{variant === 'map' ? 'All types' : 'Hospitals, clinics & care centres'}</option>
          {facilityTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="filter-flags">
        <legend className="field-label">Access</legend>
        {FLAGS.map(([name, label]) => (
          <label key={name} className="check">
            <input type="checkbox" checked={params.get(name) === 'true'} onChange={(e) => update({ [name]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
        </div>
      </details>
      <div className="filters-foot">
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost" onClick={clearAll}>
            Clear all
          </button>
        )}
        <button type="button" className="btn btn-primary filters-apply" onClick={() => setShowFilters(false)}>
          {results.loading ? 'Show results' : `Show ${data?.total ?? 0} ${data?.total === 1 ? 'result' : 'results'}`}
        </button>
      </div>
    </aside>
  );

  const selectedInsurer = insurers.data?.find((i) => i.slug === params.get('insurer'));

  // Active filters as removable chips above the results.
  const chips = [
    params.get('q') && { key: 'q', label: `“${params.get('q')}”` },
    params.get('service') && { key: 'service', label: services.data?.find((x) => x.slug === params.get('service'))?.name || params.get('service') },
    params.get('town') && { key: 'town', label: params.get('town') },
    params.get('lat') && { key: 'lat', label: 'Near selected point', clear: { lat: '', lng: '', sort: '' } },
    selectedInsurer && { key: 'insurer', label: selectedInsurer.name },
    params.get('facility_type') && { key: 'facility_type', label: facilityTypes.find((t) => t.value === params.get('facility_type'))?.label },
    ...FLAGS.filter(([name]) => params.get(name) === 'true').map(([name, label]) => ({ key: name, label })),
  ].filter(Boolean);

  return (
    <>
      <PageHeader title={text.title} intro={text.intro} crumbs={[{ label: 'Find care', to: '/find-care/facilities' }, { label: text.crumb }]} />
      <div className="container discovery">
        {filterPanel}
        {showFilters && <div className="filters-scrim" onClick={() => setShowFilters(false)} />}
        <section className="results" aria-labelledby="results-title">
          <div className="results-toolbar">
            <div>
              <h2 id="results-title" className="results-count">
                {results.loading ? 'Searching…' : `${data?.total ?? 0} ${data?.total === 1 ? 'facility' : 'facilities'}`}
              </h2>
              {params.get('lat') && <p className="small muted">Nearest to the selected point first</p>}
            </div>
            <div className="row">
              <button className="btn btn-secondary btn-sm filters-open" onClick={() => setShowFilters(true)}>
                <SlidersHorizontal size={16} aria-hidden="true" /> Filters{activeCount ? ` (${activeCount})` : ''}
              </button>
              <label className="sort">
                <span className="sr-only">Sort by</span>
                <select className="select" value={params.get('sort') || 'relevance'} onChange={(e) => update({ sort: e.target.value === 'relevance' ? '' : e.target.value })}>
                  <option value="relevance">Most complete listings</option>
                  <option value="rating">ReproCare rating</option>
                  <option value="name">Name (A–Z)</option>
                  {params.get('lat') && <option value="distance">Distance</option>}
                </select>
              </label>
              <div className="segmented" role="group" aria-label="View">
                <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
                  <List size={16} aria-hidden="true" /> List
                </button>
                <button aria-pressed={view === 'map'} onClick={() => setView('map')}>
                  <MapIcon size={16} aria-hidden="true" /> Map
                </button>
              </div>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="filter-chips" aria-label="Active filters">
              {chips.map((c) => (
                <button key={c.key} type="button" className="filter-chip" onClick={() => update(c.clear || { [c.key]: '' })} aria-label={`Remove filter: ${c.label}`}>
                  {c.label}
                  <X size={14} aria-hidden="true" />
                </button>
              ))}
              {chips.length > 1 && (
                <button type="button" className="filter-chip-clear" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
          )}

          {variant === 'insurance' && (
            <Alert tone="info" title={selectedInsurer ? selectedInsurer.name : 'Choose your insurer'}>
              <p>{selectedInsurer ? selectedInsurer.note : 'Pick an insurer in the filters to list facilities that report accepting it.'}</p>
            </Alert>
          )}

          {view === 'map' && (
            <div className="map-panel">
              <MapView points={points} selectedId={selected} onSelect={setSelected} onPick={onPick} center={center} zoom={center ? 12 : 6} fitToPoints={!center} height={variant === 'map' ? 520 : 420} />
              <p className="small muted map-help">
                {markers.loading ? 'Loading map markers…' : `${points.length} facilities with stored coordinates. Tap the map to list the nearest facilities first.`}
              </p>
            </div>
          )}

          {results.loading && <LoadingState rows={4} height={170} label="Loading facilities" />}
          {results.error && <ErrorState error={results.error} onRetry={results.reload} />}
          {data && data.total === 0 && (
            <EmptyState
              title="No facilities match all of these filters"
              action={
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={clearAll}>
                    Clear filters
                  </button>
                  {params.get('town') && (
                    <button className="btn btn-secondary" onClick={() => update({ town: '' })}>
                      Search all towns
                    </button>
                  )}
                  <Link className="btn btn-ghost" to="/health-community/free-care">
                    See community programmes
                  </Link>
                </div>
              }
            >
              Try removing a filter, searching a nearby town, or looking for a related service. We never pad results with listings that do not match.
            </EmptyState>
          )}
          {data && data.total > 0 && (
            <>
              <div className="result-list">
                {data.items.map((f) => (
                  <FacilityCard key={f.slug} facility={f} highlightService={params.get('service')} selected={selected === f.slug} onSelect={view === 'map' ? setSelected : undefined} onRequest={setRequesting} />
                ))}
              </div>
              <Pagination showSummary={false}
                page={data.page}
                pages={data.pages}
                total={data.total}
                pageSize={data.page_size}
                noun="facilities"
                onChange={(p) => {
                  update({ page: p });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
          <p className="small muted results-foot">
            Looking for a place not listed here? <Link to="/find-care/google">Search Google Maps live</Link> or <Link to="/contact?topic=listing_correction">tell us about it</Link>.
          </p>
        </section>
      </div>
      {requesting && <AppointmentModal facility={requesting} onClose={() => setRequesting(null)} />}
    </>
  );
}
