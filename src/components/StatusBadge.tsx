import type { SimulationStatus } from '../types';
import { formatPercent } from '../utils/helpers';

interface StatusBadgeProps {
  status: SimulationStatus;
}

const LABELS: Record<SimulationStatus, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  critical: 'Critical',
  completed: 'Completed',
  failed: 'Failed',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status]}</span>;
}

interface ProbabilityMeterProps {
  value: number;
}

export function ProbabilityMeter({ value }: ProbabilityMeterProps) {
  const tone = value >= 70 ? 'good' : value >= 45 ? 'warn' : 'bad';

  return (
    <div className={`probability-meter probability-meter--${tone}`} aria-label={`Success probability ${formatPercent(value)}`}>
      <div className="probability-meter__header">
        <span>Success probability</span>
        <strong>{formatPercent(value)}</strong>
      </div>
      <div className="probability-meter__track" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
        <div className="probability-meter__fill" style={{ width: `${clampWidth(value)}%` }} />
      </div>
    </div>
  );
}

function clampWidth(value: number): number {
  return Math.max(4, Math.min(100, value));
}
