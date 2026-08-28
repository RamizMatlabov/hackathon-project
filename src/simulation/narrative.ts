import type { SimulationMetrics, SimulationState } from '../types';

/**
 * Deterministic narrative from live metrics — never scenario-hardcoded.
 */
export function generateNarrative(state: SimulationState): string {
  const m = state.metrics;
  const parts: string[] = [];

  const criticalTasks = state.tasks.filter(
    (t) =>
      t.status !== 'completed' &&
      (t.priority === 'high' || t.status === 'needs_restructure' || t.status === 'blocked'),
  ).length;

  if (m.remainingDays <= 0) {
    return 'The deadline has arrived. Remaining open work will determine success or failure.';
  }

  if (m.teamCapacity >= 60 && criticalTasks > 0 && m.remainingDays <= 4) {
    parts.push(
      'Your team has enough capacity to complete the current critical tasks, but the deadline is becoming the dominant risk.',
    );
  } else if (m.teamCapacity < 40) {
    parts.push(
      'Team capacity is strained relative to open work — throughput may stall without help or scope cuts.',
    );
  } else if (criticalTasks === 0 && m.openTasks > 0) {
    parts.push('No critical blockers remain; steady progress on open tasks is the main path forward.');
  } else if (m.teamCapacity >= 60) {
    parts.push('Team capacity looks healthy for the current workload.');
  }

  if (m.timePressure >= 70) {
    parts.push('Schedule pressure is high — calendar risk outweighs other constraints.');
  } else if (m.timePressure <= 35 && m.remainingDays >= 4) {
    parts.push('The schedule has breathing room.');
  }

  if (m.resourcePressure >= 70) {
    parts.push('Resource headroom is thin; spend or buffer shocks will hurt quickly.');
  } else if (m.resourcePressure <= 30 && state.tasks.some((t) => t.status === 'blocked')) {
    parts.push('Resources are healthy enough that blocked work could be unblocked with a deliberate push.');
  }

  if (m.risk >= 70) {
    parts.push('Aggregate risk is elevated — success probability will keep eroding until pressure drops.');
  } else if (m.risk <= 35 && m.successProbability >= 70) {
    parts.push('Risk is contained; the plan is currently favoring a successful outcome.');
  }

  if (m.outcomeQuality <= 55) {
    parts.push('Outcome quality has been traded away — delivery odds may look better than the product that ships.');
  }

  if (parts.length === 0) {
    return `Day ${state.day} of ${state.deadlineDays}: ${m.openTasks} open tasks, ${m.remainingDays} days left, success at ${m.successProbability}%.`;
  }

  return parts.slice(0, 3).join(' ');
}

export function recentChangesFromMetrics(
  before: SimulationMetrics,
  after: SimulationMetrics,
): { id: string; label: string; direction: 'increase' | 'decrease' | 'neutral'; detail?: string }[] {
  const entries: Array<{
    key: keyof SimulationMetrics;
    label: string;
    higherIsBetter: boolean;
  }> = [
    { key: 'successProbability', label: 'Success probability', higherIsBetter: true },
    { key: 'risk', label: 'Risk', higherIsBetter: false },
    { key: 'timePressure', label: 'Time pressure', higherIsBetter: false },
    { key: 'resourcePressure', label: 'Resource pressure', higherIsBetter: false },
    { key: 'teamCapacity', label: 'Team capacity', higherIsBetter: true },
    { key: 'openTasks', label: 'Open tasks', higherIsBetter: false },
    { key: 'remainingDays', label: 'Days remaining', higherIsBetter: true },
    { key: 'teamSize', label: 'Team size', higherIsBetter: true },
    { key: 'outcomeQuality', label: 'Outcome quality', higherIsBetter: true },
  ];

  const changes = [];
  for (const entry of entries) {
    const delta = after[entry.key] - before[entry.key];
    if (delta === 0) continue;
    const direction: 'increase' | 'decrease' = delta > 0 ? 'increase' : 'decrease';
    const sign = delta > 0 ? '+' : '';
    changes.push({
      id: `rc_${entry.key}`,
      label: entry.label,
      direction,
      detail: `${sign}${delta}`,
    });
  }
  return changes;
}
