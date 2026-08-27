import type { SimulationEvent } from '../types';

interface ActivityLogProps {
  events: SimulationEvent[];
}

export function ActivityLog({ events }: ActivityLogProps) {
  return (
    <section className="panel activity-log" aria-labelledby="activity-heading">
      <header className="panel__header">
        <h2 id="activity-heading">Activity log</h2>
        <p>Chronological simulation events</p>
      </header>
      <ol className="activity-log__list">
        {events.map((event) => (
          <li key={event.id} className={`activity-log__item activity-log__item--${event.category}`}>
            <div className="activity-log__meta">
              <span className="activity-log__day">Day {event.day}</span>
              <span className="activity-log__category">{event.category}</span>
            </div>
            <strong className="activity-log__title">{event.title}</strong>
            <p className="activity-log__detail">{event.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
