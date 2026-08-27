import type { Decision } from '../types';

interface DecisionPanelProps {
  decisions: Decision[];
  lastConsequence: string | null;
  onDecide: (decisionId: string) => void;
}

export function DecisionPanel({ decisions, lastConsequence, onDecide }: DecisionPanelProps) {
  return (
    <section className="panel decision-panel" aria-labelledby="decision-heading">
      <header className="panel__header">
        <h2 id="decision-heading">Decision desk</h2>
        <p>Choose an intervention. Consequences update the simulation immediately.</p>
      </header>

      {lastConsequence && (
        <div className="decision-panel__consequence" role="status">
          <span className="decision-panel__consequence-label">Latest consequence</span>
          <p>{lastConsequence}</p>
        </div>
      )}

      <ul className="decision-panel__list">
        {decisions.map((decision) => (
          <li key={decision.id}>
            <button
              type="button"
              className="decision-card"
              disabled={!decision.available}
              onClick={() => onDecide(decision.id)}
            >
              <span className="decision-card__title">{decision.title}</span>
              <span className="decision-card__desc">{decision.description}</span>
              <span className="decision-card__action">
                {decision.available ? 'Apply decision' : 'Unavailable'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
