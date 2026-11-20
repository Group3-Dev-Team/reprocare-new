import { Link } from 'react-router-dom';
import { Building2, CalendarCheck, Clock, FlaskConical, MapPin, Stethoscope, Video } from 'lucide-react';
import { images } from '../data/images';
import { useCompare, MAX_COMPARE } from '../hooks/useCompare';
import { DemoLabel, Rating, RegistrationLabel } from './Badges';
import { SaveButton } from './SaveButton';

const typeIcon = { laboratory: FlaskConical, hospital: Building2 };

/** One search result. Leads with the requested service, then practical access details and sources. */
export function FacilityCard({ facility, highlightService, selected, onSelect, onRequest }) {
  const compare = useCompare();
  const Icon = typeIcon[facility.facility_type] || Stethoscope;
  const image = images[facility.image_key];
  const facilityServices = Array.isArray(facility.services) ? facility.services : [];
  const facilityInsurers = Array.isArray(facility.insurers) ? facility.insurers : [];
  const services = highlightService
    ? [...facilityServices].sort((a, b) => (b.slug === highlightService) - (a.slug === highlightService))
    : facilityServices;
  const inCompare = compare.has(facility.slug);
  const compareFull = !inCompare && compare.items.length >= MAX_COMPARE;
  const distance = facility.distance_km != null && Number.isFinite(Number(facility.distance_km)) ? Number(facility.distance_km).toFixed(1) : null;

  return (
    <article
      id={`facility-${facility.slug}`}
      className={`facility-card ${selected ? 'is-selected' : ''}`}
      onMouseEnter={() => onSelect?.(facility.slug)}
      onFocus={() => onSelect?.(facility.slug)}
    >
      <div className={`facility-thumb thumb-${facility.facility_type}`}>
        {image ? <img src={image.src} alt="" loading="lazy" /> : <Icon size={28} aria-hidden="true" />}
      </div>
      <div className="facility-body">
        <div className="facility-head">
          <div>
            <p className="facility-type">
              {facility.type_label}
              {distance != null && <> · {distance} km away</>}
            </p>
            <h3>
              <Link to={`/facilities/${facility.slug}`}>{facility.name}</Link>
            </h3>
            <p className="facility-place">
              <MapPin size={14} aria-hidden="true" />
              {[facility.area, facility.town].filter(Boolean).join(', ')}
            </p>
          </div>
          <SaveButton facility={facility} />
        </div>

        <ul className="tag-list" aria-label="Services">
          {services.slice(0, 5).map((s) => (
            <li key={s.slug} className={`tag ${s.slug === highlightService ? 'tag-match' : ''}`}>
              {s.name}
            </li>
          ))}
          {services.length > 5 && <li className="tag tag-more">+{services.length - 5} more</li>}
        </ul>

        <ul className="facility-facts">
          <li>
            <Clock size={14} aria-hidden="true" />
            {facility.open_24_hours ? 'Open 24 hours' : facility.weekday_hours ? `Weekdays ${facility.weekday_hours}` : 'Hours not listed'}
            {facility.open_weekends && !facility.open_24_hours ? ' · weekends' : ''}
          </li>
          {facility.offers_telehealth && (
            <li>
              <Video size={14} aria-hidden="true" /> Telehealth
            </li>
          )}
          {facilityInsurers.length > 0 && <li>Reports accepting {facilityInsurers.map((i) => i.name.replace(/ \(.*\)/, '')).slice(0, 3).join(', ')}</li>}
        </ul>

        <div className="facility-foot">
          <div className="facility-sources">
            <RegistrationLabel status={facility.registration_status} />
            {facility.is_demo && <DemoLabel />}
            <Rating rating={facility.rating} isDemo={facility.is_demo} demoSeed={facility.slug} />
          </div>
          <div className="row">
            <label className="compare-toggle" title={compareFull ? `You can compare up to ${MAX_COMPARE} facilities. Remove one first.` : undefined}>
              <input type="checkbox" checked={inCompare} disabled={compareFull} onChange={() => compare.toggle(facility)} />
              Compare
            </label>
            {facility.accepts_appointment_requests && onRequest ? (
              <button className="btn btn-primary btn-sm" onClick={() => onRequest(facility)}>
                <CalendarCheck size={15} aria-hidden="true" /> Request appointment
              </button>
            ) : (
              <Link to={`/facilities/${facility.slug}`} className="btn btn-secondary btn-sm">
                View details
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
