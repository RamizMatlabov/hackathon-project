import type { SimulationMetrics, SimulationState } from '../types';

/** Reusable world-state predicates for conditional consequences / events. */
export const conditions = {
  shortDeadline: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.remainingDays : s.remainingDays) <= 3,

  lowTeamCapacity: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.teamCapacity : s.teamCapacity) < 70,

  highRisk: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.risk : s.risk) > 70,

  criticalRisk: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.risk : s.risk) >= 78,

  highResources: (state: SimulationState) => {
    if (state.resources.length === 0) return false;
    const avgRemaining =
      state.resources.reduce((sum, r) => {
        if (r.amount <= 0) return sum;
        return sum + r.remaining / r.amount;
      }, 0) / state.resources.length;
    return avgRemaining >= 0.65 && state.metrics.resourcePressure < 40;
  },

  resourcesAlreadyHigh: (state: SimulationState) => {
    if (state.resources.length === 0) return false;
    const avgRemaining =
      state.resources.reduce((sum, r) => {
        if (r.amount <= 0) return sum;
        return sum + r.remaining / r.amount;
      }, 0) / state.resources.length;
    return avgRemaining >= 0.8 && state.metrics.resourcePressure <= 25;
  },

  hasBlockedTasks: (state: SimulationState) =>
    state.tasks.some((t) => t.status === 'blocked'),

  highTeamCapacity: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.teamCapacity : s.teamCapacity) >= 70,

  comfortableDeadline: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.remainingDays : s.remainingDays) >= 5 &&
    ('metrics' in s ? s.metrics.timePressure : s.timePressure) < 45,

  overloadedTeam: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.teamCapacity : s.teamCapacity) < 35,

  resourceShortage: (s: SimulationState | SimulationMetrics) =>
    ('metrics' in s ? s.metrics.resourcePressure : s.resourcePressure) > 75,

  scheduleRecovered: (before: SimulationMetrics, after: SimulationMetrics) =>
    before.timePressure >= 60 && after.timePressure < 40,

  riskThresholdCrossed: (before: SimulationMetrics, after: SimulationMetrics) =>
    before.risk < 70 && after.risk >= 70,

  opportunityWindow: (state: SimulationState) => {
    const capacity =
      'metrics' in state ? state.metrics.teamCapacity : 0;
    const remaining =
      'metrics' in state ? state.metrics.remainingDays : 0;
    const timePressure =
      'metrics' in state ? state.metrics.timePressure : 0;
    return (
      capacity >= 70 &&
      remaining >= 5 &&
      timePressure < 45 &&
      state.metrics.resourcePressure < 50 &&
      state.metrics.risk < 45
    );
  },

  deadlineAlreadyTight: (state: SimulationState) => state.deadlineDays <= 4,

  teamAtCapacity: (state: SimulationState) => state.team.length >= 6,

  hasRemovableTasks: (state: SimulationState) =>
    state.tasks.some(
      (t) =>
        t.status === 'pending' ||
        t.status === 'blocked' ||
        t.status === 'needs_restructure' ||
        (t.status !== 'completed' && t.priority !== 'high'),
    ),

  hasNonCriticalTasks: (state: SimulationState) =>
    state.tasks.some((t) => t.priority !== 'high' && t.status !== 'completed'),
};

export type ConditionName = keyof typeof conditions;
