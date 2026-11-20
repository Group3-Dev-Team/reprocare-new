import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { useFetch } from '../hooks/useFetch';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { PractitionerCard } from '../components/PractitionerCard';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';

export default function SpecialistsPage() {
  useDocumentTitle('Specialists & practitioners', 'Find obstetricians, midwives, fertility specialists, counsellors and other reproductive health practitioners in Kenya.');
  const [params, setParams] = useSearchParams();
  const specialties = useFetch(() => api.specialties(), []);
  const towns = useFetch(() => api.towns(), []);
  const key = params.toString();
  const page = Number(params.get('page') || 1);
  const results = useFetch(() => api.practitioners({ ...Object.fromEntries(params.entries()), page, page_size: 15 }), [key]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };
  const data = results.data;

  return (
    <>
      <PageHeader
        title="Specialists & practitioners"
        intro="Doctors, midwives, nurses, sonographers and counsellors working in reproductive health. Where a professional register has been checked, the listing says which one and when."
        crumbs={[{ label: 'Find care', to: '/find-care/facilities' }, { label: 'Specialists' }]}
      >
        <form
          className="inline-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: new FormData(e.currentTarget).get('q') });
          }}
        >
          <label className="sr-only" htmlFor="practitioner-q">
            Search practitioners
          </label>
          <input id="practitioner-q" name="q" className="input" defaultValue={params.get('q') || ''} placeholder="Name, specialty or town" />
          <button className="btn btn-primary">Search</button>
        </form>
      </PageHeader>
      <div className="container section-sm">
        <div className="filter-row">
          <select className="select" aria-label="Specialty" value={params.get('specialty') || ''} onChange={(e) => update({ specialty: e.target.value })}>
            <option value="">All specialties</option>
            {(specialties.data || []).map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.count})
              </option>
            ))}
          </select>
          <select className="select" aria-label="Town" value={params.get('town') || ''} onChange={(e) => update({ town: e.target.value })}>
            <option value="">All towns</option>
            {(towns.data || []).slice().sort((a, b) => a.town.localeCompare(b.town)).map((t) => (
              <option key={t.town}>{t.town}</option>
            ))}
          </select>
          <select className="select" aria-label="Gender" value={params.get('gender') || ''} onChange={(e) => update({ gender: e.target.value })}>
            <option value="">Any gender</option>
            <option value="female">Female practitioner</option>
            <option value="male">Male practitioner</option>
          </select>
          <label className="check">
            <input type="checkbox" checked={params.get('telehealth') === 'true'} onChange={(e) => update({ telehealth: e.target.checked })} />
            <span>Telehealth</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={params.get('verified_only') === 'true'} onChange={(e) => update({ verified_only: e.target.checked })} />
            <span>Register checked</span>
          </label>
        </div>
        <h2 className="results-count">{results.loading ? 'Searching…' : `${data?.total ?? 0} practitioners`}</h2>
        {results.loading && <LoadingState rows={3} height={140} />}
        {results.error && <ErrorState error={results.error} onRetry={results.reload} />}
        {data?.total === 0 && (
          <EmptyState title="No practitioners match these filters" action={<button className="btn btn-primary" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>}>
            Try another specialty or town, or search hospitals and clinics that offer the service.
          </EmptyState>
        )}
        {data?.total > 0 && (
          <>
            <div className="card-grid">
              {data.items.map((p) => (
                <PractitionerCard key={p.slug} practitioner={p} />
              ))}
            </div>
            <Pagination showSummary={false} page={data.page} pages={data.pages} total={data.total} pageSize={data.page_size} noun="practitioners" onChange={(p) => update({ page: p })} />
          </>
        )}
      </div>
    </>
  );
}
