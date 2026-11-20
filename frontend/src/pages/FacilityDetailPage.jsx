import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Accessibility, Building2, CalendarCheck, Clock, Columns3, CreditCard, FlaskConical, Languages, Mail, MapPin, Navigation, Phone, Video } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useCompare } from '../hooks/useCompare';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { images } from '../data/images';
import { formatDate } from '../data/labels';
import { serviceIcons } from '../data/serviceIcons';
import { Breadcrumbs } from '../components/PageHeader';
import { CommunityVoice } from '../components/CommunityVoice';
import { DemoLabel, Rating, RegistrationLabel, SourceLabel, Stars } from '../components/Badges';
import { SaveButton } from '../components/SaveButton';
import { MapView } from '../components/MapView';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewForm } from '../components/ReviewForm';
import { AppointmentModal } from '../components/AppointmentModal';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/Feedback';
import NotFoundPage from './NotFoundPage';

export default function FacilityDetailPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const compare = useCompare();
  const facility = useFetch(() => api.facility(slug), [slug]);
  const [reviewPage, setReviewPage] = useState(1);
  const reviews = useFetch(() => api.facilityReviews(slug, { page: reviewPage, page_size: 6 }), [slug, reviewPage]);
  const [requesting, setRequesting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const f = facility.data;
  useDocumentTitle(f?.name, f ? `${f.type_label} in ${f.town}: services, opening hours, sources and patient experiences.` : undefined);

  if (facility.error?.status === 404) return <NotFoundPage what="facility" />;
  if (facility.error) return <div className="container section"><ErrorState error={facility.error} onRetry={facility.reload} /></div>;
  if (!f) return <div className="container section"><LoadingState rows={3} height={180} /></div>;

  const image = images[f.image_key];
  const directions = f.latitude ? `https://www.google.com/maps/dir/?api=1&destination=${f.latitude},${f.longitude}` : null;
  const checked = f.registration.checked_on;

  return (
    <>
      <header className="detail-hero">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Find care', to: '/find-care/facilities' }, { label: f.facility_type === 'laboratory' ? 'Laboratories' : 'Hospitals & clinics', to: f.facility_type === 'laboratory' ? '/find-care/laboratories' : '/find-care/facilities' }, { label: f.name }]} />
          <div className="detail-hero-grid">
            <div className={`detail-media thumb-${f.facility_type}`}>
              {image ? <img src={image.src} alt={image.alt} /> : f.facility_type === 'laboratory' ? <FlaskConical size={44} aria-hidden="true" /> : <Building2 size={44} aria-hidden="true" />}
            </div>
            <div>
              <p className="facility-type">{f.type_label}</p>
              <h1>{f.name}</h1>
              <p className="facility-place">
                <MapPin size={16} aria-hidden="true" /> {f.address || `${f.area}, ${f.town}`}
              </p>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <RegistrationLabel status={f.registration_status} />
                {f.is_demo && <DemoLabel />}
                <Rating rating={f.rating} />
              </div>
              <div className="row detail-actions">
                {f.accepts_appointment_requests && (!user || user.role === 'patient') && (
                  <button className="btn btn-primary" onClick={() => setRequesting(true)}>
                    <CalendarCheck size={17} aria-hidden="true" /> Request appointment
                  </button>
                )}
                {f.phone && (
                  <a className="btn btn-secondary" href={`tel:${f.phone.replace(/\s/g, '')}`}>
                    <Phone size={17} aria-hidden="true" /> Call {f.phone}
                  </a>
                )}
                {directions && (
                  <a className="btn btn-secondary" href={directions} target="_blank" rel="noreferrer">
                    <Navigation size={17} aria-hidden="true" /> Directions
                  </a>
                )}
                <SaveButton facility={f} withLabel />
                <button className="btn btn-ghost" aria-pressed={compare.has(f.slug)} onClick={() => compare.toggle(f)}>
                  <Columns3 size={17} aria-hidden="true" /> {compare.has(f.slug) ? 'In comparison' : 'Compare'}
                </button>
              </div>
              {!f.accepts_appointment_requests && <p className="small muted">This facility does not take requests through ReproCare. Contact it directly.</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="container detail-layout">
        <div className="detail-main">
          <section className="panel" aria-labelledby="about">
            <div className="panel-title">
              <h2 id="about">About this facility</h2>
              <SourceLabel layer="provider">Stated by the facility</SourceLabel>
            </div>
            <p>{f.description || 'The facility has not added a description yet.'}</p>
          </section>

          <section className="panel" aria-labelledby="services">
            <div className="panel-title">
              <h2 id="services">Services</h2>
              <SourceLabel layer="provider">Stated by the facility</SourceLabel>
            </div>
            {f.services.length ? (
              <ul className="service-list">
                {f.services.map((s) => {
                  const Icon = serviceIcons[s.slug];
                  return (
                    <li key={s.slug}>
                      {Icon && <Icon size={18} aria-hidden="true" />}
                      <Link to={`/find-care/facilities?service=${s.slug}&town=${encodeURIComponent(f.town)}`}>{s.name}</Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">No services listed yet.</p>
            )}
            <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
              Services can change. Call ahead to confirm the one you need is available on the day you plan to visit.
            </p>
          </section>

          {f.lab_tests.length > 0 && (
            <section className="panel" aria-labelledby="tests">
              <div className="panel-title">
                <h2 id="tests">Laboratory tests</h2>
                <SourceLabel layer="provider">Prices stated by the laboratory</SourceLabel>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th>Sample</th>
                      <th>Turnaround</th>
                      <th>Price</th>
                      <th>Home collection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.lab_tests.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.name}</strong>
                        </td>
                        <td>{t.sample_type}</td>
                        <td>{t.turnaround}</td>
                        <td>{t.price_note}</td>
                        <td>{t.home_collection ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {f.practitioners.length > 0 && (
            <section className="panel" aria-labelledby="team">
              <h2 id="team">Practitioners listed here</h2>
              <ul className="people-list">
                {f.practitioners.map((p) => (
                  <li key={p.slug}>
                    <Link to={`/find-care/specialists/${p.slug}`}>{p.full_name}</Link>
                    <span className="small muted">{p.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <CommunityVoice slug={slug} />

          <section className="panel" aria-labelledby="experiences">
            <div className="panel-title">
              <h2 id="experiences">Patient experiences</h2>
              {user?.role === 'patient' && (
                <button className="btn btn-secondary btn-sm" onClick={() => setReviewing(true)}>
                  Share your experience
                </button>
              )}
              {!user && (
                <Link className="btn btn-secondary btn-sm" to={`/sign-in?next=/facilities/${f.slug}`}>
                  Sign in to share yours
                </Link>
              )}
            </div>
            {reviews.data && reviews.data.total > 0 && (
              <div className="rating-summary">
                <div>
                  <strong className="rating-big">{f.rating.average?.toFixed(1)}</strong>
                  <Stars value={f.rating.average} size={18} />
                  <p className="small muted">{f.rating.count} moderated ReproCare reviews</p>
                </div>
                <ul className="distribution" aria-label="Rating distribution">
                  {Object.entries(reviews.data.distribution).map(([star, count]) => (
                    <li key={star}>
                      <span>{star} star</span>
                      <span className="bar">
                        <span style={{ width: `${(count / reviews.data.total) * 100}%` }} />
                      </span>
                      <span>{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="small muted">
              Reviews describe individual experiences such as waiting time and communication. They are not a measure of clinical quality, and a small number of reviews
              cannot represent every patient.
            </p>
            {reviews.loading && <LoadingState rows={2} height={110} />}
            {reviews.data && reviews.data.total === 0 && <EmptyState title="No ReproCare reviews yet">Patients who have visited can share their experience after signing in.</EmptyState>}
            <div className="stack">
              {reviews.data?.items.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
            {reviews.data && reviews.data.pages > 1 && (
              <Pagination page={reviews.data.page} pages={reviews.data.pages} total={reviews.data.total} pageSize={reviews.data.page_size} noun="reviews" onChange={setReviewPage} />
            )}
          </section>
        </div>

        <aside className="detail-side">
          <section className="panel">
            <h2>Opening hours</h2>
            <dl className="definition-list">
              <dt>Weekdays</dt>
              <dd>{f.weekday_hours || 'Not stated'}</dd>
              <dt>Saturday</dt>
              <dd>{f.saturday_hours || 'Not stated'}</dd>
              <dt>Sunday</dt>
              <dd>{f.sunday_hours || 'Not stated'}</dd>
            </dl>
            <ul className="facility-facts" style={{ marginTop: 16 }}>
              {f.open_24_hours && (
                <li>
                  <Clock size={14} aria-hidden="true" /> Open 24 hours
                </li>
              )}
              {f.offers_telehealth && (
                <li>
                  <Video size={14} aria-hidden="true" /> Telehealth consultations
                </li>
              )}
            </ul>
          </section>

          <section className="panel">
            <h2>Location</h2>
            {f.latitude != null ? (
              <MapView points={[{ id: f.slug, name: f.name, latitude: f.latitude, longitude: f.longitude, subtitle: f.town, demo: f.is_demo }]} selectedId={f.slug} height={220} zoom={14} label={`Map showing ${f.name}`} />
            ) : (
              <p className="muted">No map location stored for this facility.</p>
            )}
            <p className="small" style={{ marginTop: 12 }}>
              {f.address}
            </p>
          </section>

          <section className="panel">
            <h2>Contact and access</h2>
            <ul className="contact-list">
              {f.phone && (
                <li>
                  <Phone size={16} aria-hidden="true" /> <a href={`tel:${f.phone.replace(/\s/g, '')}`}>{f.phone}</a>
                </li>
              )}
              {f.email && (
                <li>
                  <Mail size={16} aria-hidden="true" /> <a href={`mailto:${f.email}`}>{f.email}</a>
                </li>
              )}
              {f.languages.length > 0 && (
                <li>
                  <Languages size={16} aria-hidden="true" /> {f.languages.join(', ')}
                </li>
              )}
              {f.payment_methods.length > 0 && (
                <li>
                  <CreditCard size={16} aria-hidden="true" /> {f.payment_methods.join(', ')}
                </li>
              )}
              {f.accessibility.length > 0 && (
                <li>
                  <Accessibility size={16} aria-hidden="true" /> {f.accessibility.join(', ')}
                </li>
              )}
              {!f.phone && !f.email && <li className="muted">No contact details have been provided.</li>}
            </ul>
          </section>

          <section className="panel">
            <h2>Insurance</h2>
            {f.insurers.length ? (
              <ul className="tag-list">
                {f.insurers.map((i) => (
                  <li key={i.slug} className="tag">
                    {i.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No insurers reported.</p>
            )}
            <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
              Reported by the facility. Your insurer decides what is covered.
            </p>
          </section>

          <section className="panel sources-panel">
            <h2>Where this information comes from</h2>
            <dl className="definition-list">
              <dt>Registration</dt>
              <dd>
                {f.registration.status === 'matched' ? `${f.registration.body}${f.registration.code ? `, ref. ${f.registration.code}` : ''}` : f.registration.status === 'unresolved' ? 'Possible match, not confirmed' : 'Not yet checked'}
                {checked && <span className="muted"> (checked {formatDate(checked)})</span>}
              </dd>
              <dt>Listing source</dt>
              <dd>{f.source ? f.source.attribution || f.source.name : 'ReproCare'}</dd>
              <dt>Last updated</dt>
              <dd>{formatDate(f.updated_at)}</dd>
            </dl>
            <Link to={`/contact?topic=listing_correction&facility=${f.slug}`} className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}>
              Report an error in this listing
            </Link>
          </section>
        </aside>
      </div>

      {requesting && <AppointmentModal facility={f} onClose={() => setRequesting(false)} />}
      {reviewing && <ReviewForm facility={f} onClose={() => setReviewing(false)} />}
    </>
  );
}
