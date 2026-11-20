import { Link } from 'react-router-dom';
import { Check, Columns3, Minus, X } from 'lucide-react';
import { api } from '../services/api';
import { useCompare } from '../hooks/useCompare';
import { useFetch } from '../hooks/useFetch';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PageHeader } from '../components/PageHeader';
import { DemoLabel, Rating, RegistrationLabel } from '../components/Badges';
import { EmptyState, LoadingState } from '../components/Feedback';

const yes = (v) => (v ? <Check size={18} color="var(--green-600)" aria-label="Yes" /> : <Minus size={18} color="var(--text-subtle)" aria-label="No" />);

export default function ComparePage() {
  useDocumentTitle('Compare facilities');
  const { items, toggle, clear } = useCompare();
  const key = items.map((i) => i.slug).join(',');
  const result = useFetch(() => Promise.all(items.map((i) => api.facility(i.slug))), [key]);
  const facilities = result.data || [];
  const allServices = [...new Map(facilities.flatMap((f) => f.services).map((s) => [s.slug, s])).values()].sort((a, b) => a.name.localeCompare(b.name));

  const rows = [
    ['Type', (f) => f.type_label],
    ['Town', (f) => `${f.area ? `${f.area}, ` : ''}${f.town}`],
    ['Registration', (f) => <RegistrationLabel status={f.registration_status} />],
    ['ReproCare reviews', (f) => <Rating rating={f.rating} />],
    ['Weekdays', (f) => f.weekday_hours || '—'],
    ['Saturday', (f) => f.saturday_hours || '—'],
    ['Sunday', (f) => f.sunday_hours || '—'],
    ['Open 24 hours', (f) => yes(f.open_24_hours)],
    ['Telehealth', (f) => yes(f.offers_telehealth)],
    ['Takes requests online', (f) => yes(f.accepts_appointment_requests)],
    ['Insurers reported', (f) => f.insurers.map((i) => i.name).join(', ') || '—'],
    ['Payment', (f) => f.payment_methods.join(', ') || '—'],
    ['Accessibility', (f) => f.accessibility.join(', ') || '—'],
  ];

  return (
    <>
      <PageHeader title="Compare facilities" intro="Practical differences side by side: services, hours, insurers and the source of each detail." crumbs={[{ label: 'Find care', to: '/find-care/facilities' }, { label: 'Compare' }]} />
      <div className="container section-sm">
        {!items.length && (
          <EmptyState icon={<Columns3 size={26} />} title="Nothing to compare yet" action={<Link className="btn btn-primary" to="/find-care/facilities">Find facilities</Link>}>
            Tick “Compare” on up to three facilities in the search results, then come back here.
          </EmptyState>
        )}
        {items.length > 0 && result.loading && <LoadingState rows={1} height={400} />}
        {facilities.length > 0 && (
          <>
            <div className="table-wrap compare-table">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sr-only">Detail</span>
                    </th>
                    {facilities.map((f) => (
                      <th key={f.slug} scope="col">
                        <Link to={`/facilities/${f.slug}`}>{f.name}</Link>
                        {f.is_demo && (
                          <div>
                            <DemoLabel />
                          </div>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => toggle(f)}>
                          <X size={14} aria-hidden="true" /> Remove
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, render]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {facilities.map((f) => (
                        <td key={f.slug}>{render(f)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <th scope="rowgroup" colSpan={facilities.length + 1} className="compare-group">
                      Services stated by each facility
                    </th>
                  </tr>
                  {allServices.map((s) => (
                    <tr key={s.slug}>
                      <th scope="row">{s.name}</th>
                      {facilities.map((f) => (
                        <td key={f.slug}>{yes(f.services.some((x) => x.slug === s.slug))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row" style={{ marginTop: 20 }}>
              <Link className="btn btn-secondary" to="/find-care/facilities">
                Add another facility
              </Link>
              <button className="btn btn-ghost" onClick={clear}>
                Clear comparison
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
