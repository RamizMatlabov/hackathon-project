import type { AgentRecommendation } from '../webmcp/types';
import { AgentRecommendationMetrics } from './AgentRecommendationMetrics';

interface AgentRecommendationProps {
  recommendation: AgentRecommendation;
  onDismiss?: () => void;
}

export function AgentRecommendationPanel({
  recommendation,
  onDismiss,
}: AgentRecommendationProps) {
  const { status, decisionTitle, estimatedImpact } = recommendation;
  const isPending = status === 'pending';
  const isStale = status === 'stale';
  const isApplied = status === 'applied';

  return (
    <section
      className={`agent-recommendation agent-recommendation--${status}`}
      aria-label="Agent recommendation"
      aria-live="polite"
    >
      <header className="agent-recommendation__header">
        <div>
          <p className="agent-recommendation__eyebrow">Agent recommendation</p>
          <h2 className="agent-recommendation__title">{decisionTitle}</h2>
        </div>
        <div className="agent-recommendation__badges">
          <span className="agent-recommendation__badge agent-recommendation__badge--agent">
            Agent preview
          </span>
          <span className={`agent-recommendation__badge impact-pill impact-pill--${estimatedImpact}`}>
            {estimatedImpact} impact
          </span>
          {isApplied && (
            <span className="agent-recommendation__badge agent-recommendation__badge--applied">
              Applied
            </span>
          )}
          {isStale && (
            <span className="agent-recommendation__badge agent-recommendation__badge--stale">
              Expired
            </span>
          )}
        </div>
      </header>

      {isPending && (
        <>
          <p className="agent-recommendation__safety">
            Preview only — the live simulation has <strong>not</strong> changed.
          </p>
          <AgentRecommendationMetrics changes={recommendation.changes} />
          <p className="agent-recommendation__next">
            Awaiting confirmation — apply this decision to continue.
          </p>
        </>
      )}

      {isStale && (
        <>
          <p className="agent-recommendation__stale-message">
            Preview expired — the simulation changed since this preview. Ask the agent to preview
            again before applying.
          </p>
          {onDismiss && (
            <button type="button" className="btn btn--ghost agent-recommendation__dismiss" onClick={onDismiss}>
              Dismiss
            </button>
          )}
        </>
      )}

      {isApplied && (
        <p className="agent-recommendation__applied-message">
          Decision applied — updated metrics are reflected in the workspace below.
        </p>
      )}

      <p className="agent-recommendation__flow">
        Agent analyzes → previews → human confirms → simulation changes
      </p>
    </section>
  );
}
