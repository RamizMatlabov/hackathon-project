import type { MetricChange, ScenarioCompareResult } from '../types';

interface ScenarioCompareProps {
  compare: ScenarioCompareResult | null;
  branchDecisionId: string | null;
  decisions: Array<{ id: string; title: string; available: boolean }>;
  onSelectBranch: (decisionId: string | null) => void;
  onClear: () => void;
}

function formatMetric(change: MetricChange, side: 'before' | 'after'): string {
  const value = side === 'before' ? change.before : change.after;
  const suffix =
    change.unit === '%' ? '%' : change.unit === 'days' ? 'd' : '';
  return `${value}${suffix}`;
}

export function ScenarioCompare({
  compare,
  branchDecisionId,
  decisions,
  onSelectBranch,
  onClear,
}: ScenarioCompareProps) {
  return (
    <section className="panel scenario-compare" aria-labelledby="branch-heading">
      <header className="panel__header">
        <h2 id="branch-heading">Scenario comparison</h2>
        <p>Temporary branch — preview an alternate plan against the current world</p>
      </header>

      <div className="scenario-compare__controls">
        <label className="scenario-compare__label" htmlFor="branch-decision">
          Scenario B decision
        </label>
        <select
          id="branch-decision"
          value={branchDecisionId ?? ''}
          onChange={(e) => onSelectBranch(e.target.value || null)}
        >
          <option value="">Select a decision to branch…</option>
          {decisions
            .filter((d) => d.available)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
        </select>
        {branchDecisionId && (
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            Clear branch
          </button>
        )}
      </div>

      {!compare || !branchDecisionId ? (
        <p className="scenario-compare__empty">
          Choose a decision to compare Scenario A (current plan) with a temporary Scenario B.
        </p>
      ) : (
        <div className="scenario-compare__grid">
          <div className="scenario-compare__col">
            <h3>Scenario A</h3>
            <p className="scenario-compare__name">{compare.scenarioA.label}</p>
            <ul>
              <li>
                Success {compare.scenarioA.metrics.successProbability}%
              </li>
              <li>Risk {compare.scenarioA.metrics.risk}%</li>
              <li>Time pressure {compare.scenarioA.metrics.timePressure}%</li>
              <li>Resource pressure {compare.scenarioA.metrics.resourcePressure}%</li>
              <li>Tasks remaining {compare.scenarioA.metrics.openTasks}</li>
            </ul>
          </div>
          <div className="scenario-compare__col scenario-compare__col--b">
            <h3>Scenario B</h3>
            <p className="scenario-compare__name">
              {compare.scenarioB.decisionTitle ?? compare.scenarioB.label}
            </p>
            <ul>
              <li>
                Success {compare.scenarioB.metrics.successProbability}%
              </li>
              <li>Risk {compare.scenarioB.metrics.risk}%</li>
              <li>Time pressure {compare.scenarioB.metrics.timePressure}%</li>
              <li>Resource pressure {compare.scenarioB.metrics.resourcePressure}%</li>
              <li>Tasks remaining {compare.scenarioB.metrics.openTasks}</li>
            </ul>
          </div>
          {compare.deltas.length > 0 && (
            <div className="scenario-compare__deltas">
              <h3>Deltas (A → B)</h3>
              <ul>
                {compare.deltas.map((d) => {
                  const delta = d.after - d.before;
                  const sign = delta > 0 ? '+' : '';
                  return (
                    <li key={d.metric}>
                      <span>{d.label}</span>
                      <span>
                        {formatMetric(d, 'before')} → {formatMetric(d, 'after')} ({sign}
                        {delta}
                        {d.unit === '%' ? '%' : d.unit === 'days' ? 'd' : ''})
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="scenario-compare__signal">
                Signal: <strong>{compare.recommendation}</strong>
                <span> — {compare.recommendationRationale}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
