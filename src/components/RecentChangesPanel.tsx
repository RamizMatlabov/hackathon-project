import type { RecentChange } from '../types';

interface RecentChangesPanelProps {
  changes: RecentChange[];
}

export function RecentChangesPanel({ changes }: RecentChangesPanelProps) {
  return (
    <section className="panel recent-changes" aria-labelledby="recent-heading">
      <header className="panel__header">
        <h2 id="recent-heading">Recent changes</h2>
        <p>Deltas from the last decision or day advance</p>
      </header>

      {changes.length === 0 ? (
        <p className="recent-changes__empty">No changes yet — apply a decision or advance a day.</p>
      ) : (
        <ul className="recent-changes__list">
          {changes.map((change) => (
            <li
              key={change.id}
              className={`recent-changes__item recent-changes__item--${change.direction}`}
            >
              <span className="recent-changes__sign" aria-hidden="true">
                {change.direction === 'increase'
                  ? '+'
                  : change.direction === 'decrease'
                    ? '−'
                    : '·'}
              </span>
              <span className="recent-changes__label">{change.label}</span>
              {change.detail && (
                <span className="recent-changes__detail">{change.detail}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
