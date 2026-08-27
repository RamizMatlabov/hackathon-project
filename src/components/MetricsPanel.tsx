import type { SimulationMetrics } from '../types';
import { formatPercent } from '../utils/helpers';

interface MetricsPanelProps {
  metrics: SimulationMetrics;
}

interface GaugeProps {
  label: string;
  value: number;
  tone?: 'neutral' | 'inverse' | 'capacity';
}

function gaugeTone(value: number, mode: GaugeProps['tone']): string {
  if (mode === 'capacity') {
    if (value >= 65) return 'good';
    if (value >= 40) return 'warn';
    return 'bad';
  }
  if (mode === 'inverse') {
    if (value <= 35) return 'good';
    if (value <= 60) return 'warn';
    return 'bad';
  }
  if (value >= 70) return 'good';
  if (value >= 45) return 'warn';
  return 'bad';
}

function Gauge({ label, value, tone = 'neutral' }: GaugeProps) {
  const level = gaugeTone(value, tone);
  const width = Math.max(4, Math.min(100, value));

  return (
    <div className={`sim-gauge sim-gauge--${level}`}>
      <div className="sim-gauge__header">
        <span>{label}</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div
        className="sim-gauge__track"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <span className="sim-gauge__fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  return (
    <section className="panel metrics-panel" aria-labelledby="metrics-heading">
      <header className="panel__header">
        <h2 id="metrics-heading">Simulation metrics</h2>
        <p>Live pressures computed from the current world state</p>
      </header>

      <div className="metrics-panel__grid">
        <Gauge label="Success probability" value={metrics.successProbability} />
        <Gauge label="Risk" value={metrics.risk} tone="inverse" />
        <Gauge label="Time pressure" value={metrics.timePressure} tone="inverse" />
        <Gauge label="Resource pressure" value={metrics.resourcePressure} tone="inverse" />
        <Gauge label="Team capacity" value={metrics.teamCapacity} tone="capacity" />
      </div>

      <dl className="metrics-panel__stats">
        <div>
          <dt>Open tasks</dt>
          <dd>{metrics.openTasks}</dd>
        </div>
        <div>
          <dt>Days remaining</dt>
          <dd>{metrics.remainingDays}</dd>
        </div>
        <div>
          <dt>Team size</dt>
          <dd>{metrics.teamSize}</dd>
        </div>
      </dl>
    </section>
  );
}
