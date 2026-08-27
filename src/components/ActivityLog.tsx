import type { SimulationEvent } from '../types';

interface ActivityLogProps {
  events: SimulationEvent[];
}

const TYPE_LABELS: Record<SimulationEvent['eventType'], string> = {
  system: 'System',
  decision_applied: 'Decision Applied',
  risk_change: 'Risk Change',
  resource_change: 'Resource Change',
  team_change: 'Team Change',
  task_change: 'Task Change',
  metric_change: 'Metric Change',
  day_advanced: 'Day Advanced',
};

export function ActivityLog({ events }: ActivityLogProps) {
  return (
    <section className="panel activity-log" aria-labelledby="activity-heading">
      <header className="panel__header">
        <h2 id="activity-heading">Event log</h2>
        <p>Chronological cause and effect from the simulation</p>
      </header>
      <ol className="activity-log__list">
        {events.map((event) => (
          <li
            key={event.id}
            className={`activity-log__item activity-log__item--${event.category}`}
          >
            <div className="activity-log__meta">
              <span className="activity-log__day">Day {event.day}</span>
              <span className="activity-log__category">
                {TYPE_LABELS[event.eventType]}
              </span>
            </div>
            <strong className="activity-log__title">{event.title}</strong>
            <p className="activity-log__detail">{event.description}</p>
            {event.impact && (
              <p className="activity-log__impact">
                <span>Impact</span> {event.impact}
              </p>
            )}
            {event.relatedDecisionTitle && (
              <p className="activity-log__related">
                Related decision: {event.relatedDecisionTitle}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
