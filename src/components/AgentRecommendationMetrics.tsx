import type { MetricChange } from '../types';

const PRIMARY_METRICS = new Set([
  'successProbability',
  'risk',
  'timePressure',
  'resourcePressure',
  'teamCapacity',
  'openTasks',
  'remainingDays',
  'outcomeQuality',
]);

function formatDelta(change: MetricChange): { before: string; after: string; delta: string } {
  const suffix = change.unit === '%' ? '%' : change.unit === 'days' ? 'd' : '';
  const delta = change.after - change.before;
  const sign = delta > 0 ? '+' : '';
  return {
    before: `${change.before}${suffix}`,
    after: `${change.after}${suffix}`,
    delta: `${sign}${delta}${suffix}`,
  };
}

function deltaClass(change: MetricChange): string {
  const delta = change.after - change.before;
  if (delta === 0) return 'is-flat';

  const higherIsBetter =
    change.metric === 'successProbability' ||
    change.metric === 'teamCapacity' ||
    change.metric === 'remainingDays' ||
    change.metric === 'teamSize' ||
    change.metric === 'outcomeQuality';

  const improved = higherIsBetter ? delta > 0 : delta < 0;
  return improved ? 'is-better' : 'is-worse';
}

export function selectPrimaryMetricChanges(changes: MetricChange[]): MetricChange[] {
  return changes.filter((change) => PRIMARY_METRICS.has(change.metric));
}

interface AgentRecommendationMetricsProps {
  changes: MetricChange[];
  limit?: number;
}

export function AgentRecommendationMetrics({
  changes,
  limit = 4,
}: AgentRecommendationMetricsProps) {
  const visible = selectPrimaryMetricChanges(changes)
    .filter((change) => change.before !== change.after)
    .slice(0, limit);

  if (visible.length === 0) {
    return <p className="agent-recommendation__no-metrics">No measurable metric change projected.</p>;
  }

  return (
    <ul className="agent-recommendation__metrics">
      {visible.map((change) => {
        const values = formatDelta(change);
        return (
          <li key={change.metric} className={`agent-recommendation__metric ${deltaClass(change)}`}>
            <span className="agent-recommendation__metric-label">{change.label}</span>
            <span className="agent-recommendation__metric-values">
              <span>{values.before}</span>
              <span aria-hidden="true">→</span>
              <span>{values.after}</span>
              <span className="agent-recommendation__metric-delta">{values.delta}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
