import type { Decision } from '../types';

interface DecisionPanelProps {
  decisions: Decision[];
  selectedDecisionId: string | null;
  hasPreview: boolean;
  lastConsequence: string | null;
  onSelect: (decisionId: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

export function DecisionPanel({
  decisions,
  selectedDecisionId,
  hasPreview,
  lastConsequence,
  onSelect,
  onApply,
  onCancel,
}: DecisionPanelProps) {
  return (
    <section className="panel decision-panel" aria-labelledby="decision-heading">
      <header className="panel__header">
        <h2 id="decision-heading">Decide</h2>
        <p>Observe the world, select a decision, preview, then apply.</p>
      </header>

      {lastConsequence && !hasPreview && (
        <div className="decision-panel__consequence" role="status">
          <span className="decision-panel__consequence-label">Latest applied consequence</span>
          <p>{lastConsequence}</p>
        </div>
      )}

      <ul className="decision-panel__list">
        {decisions.map((decision) => {
          const selected = decision.id === selectedDecisionId;
          return (
            <li key={decision.id}>
              <button
                type="button"
                className={`decision-card${selected ? ' is-selected' : ''}`}
                disabled={!decision.available}
                aria-pressed={selected}
                onClick={() => onSelect(decision.id)}
              >
                <span className="decision-card__top">
                  <span className="decision-card__title">{decision.title}</span>
                  <span className={`decision-card__impact decision-card__impact--${decision.estimatedImpact}`}>
                    {decision.estimatedImpact} impact
                  </span>
                </span>
                <span className="decision-card__desc">{decision.description}</span>
                <span className="decision-card__meta">
                  <span className="decision-card__category">{decision.category}</span>
                  <span className="decision-card__action">
                    {!decision.available
                      ? 'Unavailable in this world'
                      : selected
                        ? 'Selected · preview below'
                        : 'Select to preview'}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hasPreview && (
        <div className="decision-panel__commit">
          <p>Preview ready — apply to mutate the live world, then simulate a day.</p>
          <div className="decision-panel__commit-actions">
            <button type="button" className="btn btn--primary" onClick={onApply}>
              Apply Decision
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
