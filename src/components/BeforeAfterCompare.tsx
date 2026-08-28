import type { DecisionResult, MetricChange } from '../types';

interface BeforeAfterCompareProps {
  preview: DecisionResult | null;
}

function formatValue(change: MetricChange): { before: string; after: string; delta: string } {
  const suffix =
    change.unit === '%' ? '%' : change.unit === 'days' ? 'd' : '';
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

export function BeforeAfterCompare({ preview }: BeforeAfterCompareProps) {
  const changes =
    preview?.changes.filter((c) => PRIMARY_METRICS.has(c.metric)) ?? [];

  return (
    <section className="panel before-after" aria-labelledby="compare-heading">
      <header className="panel__header">
        <h2 id="compare-heading">Before / After</h2>
        <p>
          {preview
            ? `Previewing “${preview.decisionTitle}” — not applied yet`
            : 'Metric deltas appear when a decision is selected'}
        </p>
      </header>

      {!preview && (
        <div className="before-after__empty">
          <p>Choose a decision to compare current state with projected outcomes.</p>
        </div>
      )}

      {preview && changes.length === 0 && (
        <div className="before-after__empty">
          <p>This decision produces no measurable metric change.</p>
        </div>
      )}

      {preview && changes.length > 0 && (
        <ul className="before-after__list">
          {changes.map((change) => {
            const values = formatValue(change);
            return (
              <li key={change.metric} className={`before-after__row ${deltaClass(change)}`}>
                <span className="before-after__metric">{change.label}</span>
                <div className="before-after__values">
                  <span className="before-after__before">{values.before}</span>
                  <span className="before-after__arrow" aria-hidden="true">
                    →
                  </span>
                  <span className="before-after__after">{values.after}</span>
                  <span className="before-after__delta">{values.delta}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
