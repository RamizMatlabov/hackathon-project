import type { SimulationMetrics, SimulationState } from '../types';
import { formatPercent } from '../utils/helpers';

interface WorldStatePanelProps {
  state: SimulationState;
}

function Bar({
  label,
  value,
  max = 100,
  inverse = false,
}: {
  label: string;
  value: number;
  max?: number;
  inverse?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const blocks = 10;
  const filled = Math.round((pct / 100) * blocks);
  const bar = '█'.repeat(filled) + '░'.repeat(blocks - filled);

  let tone = 'neutral';
  if (inverse) {
    tone = value <= 35 ? 'good' : value <= 60 ? 'warn' : 'bad';
  } else {
    tone = value >= 65 ? 'good' : value >= 40 ? 'warn' : 'bad';
  }

  return (
    <div className={`world-bar world-bar--${tone}`}>
      <div className="world-bar__header">
        <span>{label}</span>
        <strong>{max === 100 ? formatPercent(value) : `${value}/${max}`}</strong>
      </div>
      <div className="world-bar__track" aria-hidden="true">
        {bar}
      </div>
    </div>
  );
}

function taskProgress(metrics: SimulationMetrics, state: SimulationState): number {
  const total = state.tasks.length;
  if (total === 0) return 100;
  const done = total - metrics.openTasks;
  return Math.round((done / total) * 100);
}

export function WorldStatePanel({ state }: WorldStatePanelProps) {
  const m = state.metrics;
  const taskPct = taskProgress(m, state);

  return (
    <section className="panel world-state" aria-labelledby="world-heading">
      <header className="panel__header">
        <h2 id="world-heading">Current world</h2>
        <p>
          Day {state.day} / {state.deadlineDays}
        </p>
      </header>

      <div className="world-state__bars">
        <Bar label="Tasks" value={taskPct} />
        <Bar label="Team capacity" value={m.teamCapacity} />
        <Bar label="Resources" value={Math.max(0, 100 - m.resourcePressure)} />
        <Bar label="Risk" value={m.risk} inverse />
      </div>
    </section>
  );
}
