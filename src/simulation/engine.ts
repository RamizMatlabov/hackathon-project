import type {
  Decision,
  DecisionResult,
  EventType,
  MetricChange,
  MetricKey,
  RecentChange,
  Resource,
  Risk,
  Scenario,
  SimulationEvent,
  SimulationMetrics,
  SimulationState,
  SimulationStatus,
  Task,
  TeamMember,
} from '../types';
import { SAMPLE_RISKS, SAMPLE_TASKS } from '../data/mockScenarios';
import { clamp, createId } from '../utils/helpers';
import { conditions } from './conditions';
import { consequenceSummaries } from './consequences';
import { applyDecisionMutation, getAvailableDecisions, remainingDaysOf } from './decisions';
import {
  detectEmergentEvents,
  evolveRisks,
  generateSimulationEvent,
} from './emergentEvents';
import { generateNarrative, recentChangesFromMetrics } from './narrative';

const METRIC_LABELS: Record<MetricKey, string> = {
  successProbability: 'Success probability',
  risk: 'Risk',
  timePressure: 'Time pressure',
  resourcePressure: 'Resource pressure',
  teamCapacity: 'Team capacity',
  openTasks: 'Open tasks',
  remainingDays: 'Days remaining',
  teamSize: 'Team size',
  outcomeQuality: 'Outcome quality',
};

function openTasksOf(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== 'completed');
}

/** Overall risk score 0–100 from active risks + schedule pressure. */
export function calculateRisk(
  risks: Risk[],
  timePressure: number,
  openTaskCount: number,
): number {
  if (risks.length === 0) {
    return clamp(Math.round(timePressure * 0.35 + openTaskCount * 2), 5, 95);
  }

  const weighted = risks.reduce((sum, risk) => {
    const severityWeight =
      (risk.severity === 'low'
        ? 0
        : risk.severity === 'medium'
          ? 1
          : risk.severity === 'high'
            ? 2
            : 3) + 1;
    return sum + risk.probability * (severityWeight / 4) * 100;
  }, 0);

  const base = weighted / risks.length;
  const criticalBoost = risks.filter((r) => r.severity === 'critical').length * 8;
  const scheduleBoost = timePressure * 0.22;

  return clamp(Math.round(base + criticalBoost + scheduleBoost), 5, 98);
}

/** Time pressure 0–100 from remaining days vs open workload. */
export function calculateTimePressure(
  day: number,
  deadlineDays: number,
  tasks: Task[],
  teamSize: number,
): number {
  const remaining = remainingDaysOf(day, deadlineDays);
  const open = openTasksOf(tasks);
  const workloadDays = open.reduce((sum, t) => sum + t.estimatedDays, 0);
  const criticalOpen = open.filter(
    (t) =>
      t.priority === 'high' ||
      t.status === 'blocked' ||
      t.status === 'needs_restructure',
  ).length;

  if (remaining <= 0) return 98;

  const capacityFactor = Math.max(1, teamSize) * 0.85;
  const loadRatio = workloadDays / (remaining * capacityFactor);
  let pressure = loadRatio * 55;
  pressure += Math.max(0, 8 - remaining) * 4.5;
  pressure += criticalOpen * 5;
  pressure += open.length * 1.5;

  return clamp(Math.round(pressure), 4, 98);
}

/** Resource pressure 0–100 from remaining vs allocated resources. */
export function calculateResourcePressure(resources: Resource[]): number {
  if (resources.length === 0) return 50;

  const ratios = resources.map((r) => {
    if (r.amount <= 0) return 1;
    const consumed = 1 - r.remaining / r.amount;
    const weight = r.type === 'budget' || r.type === 'time' ? 1.35 : 1;
    return clamp(consumed * weight, 0, 1.4);
  });

  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return clamp(Math.round(avg * 100), 4, 98);
}

/** Team capacity headroom 0–100 (higher = more available capacity). */
export function calculateTeamCapacity(team: TeamMember[], tasks: Task[]): number {
  if (team.length === 0) return 8;

  const avgCapacity =
    team.reduce((sum, m) => sum + m.capacity, 0) / team.length;
  const open = openTasksOf(tasks).length;
  const assignedOpen = openTasksOf(tasks).filter((t) => t.assigneeId).length;
  const loadPerMember = open / team.length;
  const unassignedPenalty = Math.max(0, open - assignedOpen) * 4;
  const overloadPenalty = Math.max(0, loadPerMember - 2.2) * 12;

  const score = avgCapacity - unassignedPenalty - overloadPenalty - open * 1.2;
  return clamp(Math.round(score), 5, 98);
}

/** Success probability 0–100 derived from pressures, risks, and capacity. */
export function calculateSuccessProbability(
  risk: number,
  timePressure: number,
  resourcePressure: number,
  teamCapacity: number,
  riskTolerance: Scenario['riskTolerance'],
  openTasks: number,
  remainingDays: number,
  outcomeQuality: number,
): number {
  let score = 88;
  score -= risk * 0.38;
  score -= timePressure * 0.28;
  score -= resourcePressure * 0.14;
  score += teamCapacity * 0.18;
  score -= Math.max(0, openTasks - remainingDays) * 2.5;
  // Quality drag: thin scope can look "successful" but we keep a mild penalty
  score -= Math.max(0, 70 - outcomeQuality) * 0.12;

  if (riskTolerance === 'low') score -= 3;
  if (riskTolerance === 'high') score += 3;
  if (remainingDays <= 2 && openTasks > 2) score -= 10;

  // Conditional: high risk significantly hurts success
  if (risk > 70) score -= 8;

  // Conditional: high capacity + comfortable deadline lowers effective risk drag
  if (teamCapacity >= 70 && remainingDays >= 5 && timePressure < 45) {
    score += 4;
  }

  return clamp(Math.round(score), 8, 96);
}

export function computeMetrics(
  state: Pick<
    SimulationState,
    | 'day'
    | 'deadlineDays'
    | 'tasks'
    | 'risks'
    | 'resources'
    | 'team'
    | 'riskTolerance'
    | 'outcomeQuality'
  >,
): SimulationMetrics {
  const remainingDays = remainingDaysOf(state.day, state.deadlineDays);
  const openTasks = openTasksOf(state.tasks).length;
  const teamSize = state.team.length;
  const timePressure = calculateTimePressure(
    state.day,
    state.deadlineDays,
    state.tasks,
    teamSize,
  );
  const resourcePressure = calculateResourcePressure(state.resources);
  const teamCapacity = calculateTeamCapacity(state.team, state.tasks);
  let risk = calculateRisk(state.risks, timePressure, openTasks);

  // Conditional consequence mirrors: high capacity + comfortable deadline → risk down
  if (teamCapacity >= 70 && remainingDays >= 5 && timePressure < 45) {
    risk = clamp(risk - 6, 5, 98);
  }
  if (remainingDays <= 3 && teamCapacity < 70) {
    risk = clamp(risk + 5, 5, 98);
  }

  const outcomeQuality = state.outcomeQuality;
  const successProbability = calculateSuccessProbability(
    risk,
    timePressure,
    resourcePressure,
    teamCapacity,
    state.riskTolerance,
    openTasks,
    remainingDays,
    outcomeQuality,
  );

  return {
    successProbability,
    risk,
    timePressure,
    resourcePressure,
    teamCapacity,
    openTasks,
    remainingDays,
    teamSize,
    outcomeQuality,
  };
}

function deriveStatus(metrics: SimulationMetrics, risks: Risk[]): SimulationStatus {
  const hasCritical = risks.some((r) => r.severity === 'critical');
  if (metrics.remainingDays <= 0 && metrics.openTasks > 0) return 'failed';
  if (metrics.remainingDays <= 0 && metrics.openTasks === 0) return 'completed';
  if (hasCritical || metrics.successProbability < 35 || metrics.risk >= 78) {
    return 'critical';
  }
  if (
    metrics.successProbability < 55 ||
    metrics.timePressure >= 70 ||
    metrics.risk >= 55
  ) {
    return 'at_risk';
  }
  return 'on_track';
}

function bumpVersion(state: SimulationState): SimulationState {
  return {
    ...state,
    simulationVersion: (state.simulationVersion ?? 1) + 1,
  };
}

function finalizeState(
  state: SimulationState,
  options?: { recentChanges?: RecentChange[]; preserveNarrative?: boolean },
): SimulationState {
  const metrics = computeMetrics(state);
  const withMetrics: SimulationState = {
    ...state,
    remainingDays: metrics.remainingDays,
    successProbability: metrics.successProbability,
    metrics,
    outcomeQuality: metrics.outcomeQuality,
    status: deriveStatus(metrics, state.risks),
  };
  const availableDecisions = getAvailableDecisions(withMetrics);
  const narrative = generateNarrative({ ...withMetrics, availableDecisions });

  return {
    ...withMetrics,
    availableDecisions,
    narrative,
    recentChanges: options?.recentChanges ?? state.recentChanges ?? [],
  };
}

function cloneState(state: SimulationState): SimulationState {
  return {
    ...state,
    goal: { ...state.goal, successCriteria: [...state.goal.successCriteria] },
    resources: state.resources.map((r) => ({ ...r })),
    team: state.team.map((m) => ({ ...m, skills: [...m.skills] })),
    constraints: state.constraints.map((c) => ({ ...c })),
    tasks: state.tasks.map((t) => ({ ...t })),
    risks: state.risks.map((r) => ({ ...r })),
    availableDecisions: state.availableDecisions.map((d) => ({
      ...d,
      effects: d.effects.map((e) => ({ ...e })),
      possibleRisks: [...d.possibleRisks],
      payload: d.payload ? { ...d.payload } : undefined,
    })),
    decisionsHistory: [...state.decisionsHistory],
    events: state.events.map((e) => ({ ...e })),
    metrics: { ...state.metrics },
    recentChanges: state.recentChanges.map((c) => ({ ...c })),
    lastResult: state.lastResult
      ? {
          ...state.lastResult,
          before: { ...state.lastResult.before },
          after: { ...state.lastResult.after },
          changes: state.lastResult.changes.map((c) => ({ ...c })),
          consequences: state.lastResult.consequences.map((c) => ({ ...c })),
          consequenceSummaries: [...state.lastResult.consequenceSummaries],
          events: state.lastResult.events.map((e) => ({ ...e })),
          impactChain: state.lastResult.impactChain.map((s) => ({ ...s })),
          possibleRisks: [...state.lastResult.possibleRisks],
        }
      : null,
  };
}

export function createSimulationFromScenario(scenario: Scenario): SimulationState {
  const team = scenario.team.map((m) => ({ ...m, skills: [...m.skills] }));
  const taskSource = scenario.initialTasks ?? SAMPLE_TASKS;
  const riskSource = scenario.initialRisks ?? SAMPLE_RISKS;
  const startDay = scenario.startDay ?? 1;
  const tasks = taskSource.map((t, index) => ({
    ...t,
    id: scenario.initialTasks ? (t.id || createId('task')) : createId('task'),
    assigneeId: t.assigneeId ?? team[index % team.length]?.id ?? null,
    dayEnd: Math.min(t.dayEnd, scenario.deadlineDays),
    dayStart: Math.min(t.dayStart, Math.max(1, scenario.deadlineDays - 1)),
  }));
  const risks = riskSource.map((r) => ({
    ...r,
    id: scenario.initialRisks ? (r.id || createId('risk')) : createId('risk'),
  }));
  const outcomeQuality = 78;

  const draft: SimulationState = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    goal: {
      ...scenario.goal,
      successCriteria: [...scenario.goal.successCriteria],
    },
    day: startDay,
    deadlineDays: scenario.deadlineDays,
    remainingDays: remainingDaysOf(startDay, scenario.deadlineDays),
    simulationVersion: 1,
    status: 'on_track',
    successProbability: 0,
    metrics: {
      successProbability: 0,
      risk: 0,
      timePressure: 0,
      resourcePressure: 0,
      teamCapacity: 0,
      openTasks: 0,
      remainingDays: 0,
      teamSize: team.length,
      outcomeQuality,
    },
    resources: scenario.resources.map((r) => ({ ...r })),
    team,
    constraints: scenario.constraints.map((c) => ({ ...c })),
    tasks,
    risks,
    availableDecisions: [],
    decisionsHistory: [],
    events: [],
    riskTolerance: scenario.riskTolerance,
    lastDecisionId: null,
    lastConsequence: null,
    lastResult: null,
    recentChanges: [],
    narrative: '',
    outcomeQuality,
  };

  const metrics = computeMetrics(draft);
  const events: SimulationEvent[] = [
    generateSimulationEvent({
      day: startDay,
      eventType: 'system',
      title: 'Simulation initialized',
      description: `${scenario.name} is live. Goal: ${scenario.goal.title}.`,
      impact: `Baseline success probability ${metrics.successProbability}%`,
      seq: 0,
    }),
    generateSimulationEvent({
      day: startDay,
      eventType: 'risk_change',
      title: 'Baseline risks assessed',
      description: `${risks.length} active risks scored against current constraints.`,
      impact: `Risk index ${metrics.risk}% · Time pressure ${metrics.timePressure}%`,
      seq: 1,
    }),
    generateSimulationEvent({
      day: startDay,
      eventType: 'task_change',
      title: 'Workstream loaded',
      description: `${tasks.length} tasks placed on the timeline across ${scenario.team.length} team members.`,
      impact: `${metrics.openTasks} open tasks · ${metrics.remainingDays} days remaining`,
      seq: 2,
    }),
  ];

  return finalizeState({
    ...draft,
    metrics,
    events,
    successProbability: metrics.successProbability,
    remainingDays: metrics.remainingDays,
    status: deriveStatus(metrics, risks),
  });
}

const TRACKED_METRICS: MetricKey[] = [
  'successProbability',
  'risk',
  'timePressure',
  'resourcePressure',
  'teamCapacity',
  'openTasks',
  'remainingDays',
  'teamSize',
  'outcomeQuality',
];

function metricUnit(key: MetricKey): MetricChange['unit'] {
  if (key === 'openTasks' || key === 'teamSize') return 'count';
  if (key === 'remainingDays') return 'days';
  return '%';
}

function buildChanges(before: SimulationMetrics, after: SimulationMetrics): MetricChange[] {
  return TRACKED_METRICS.map((metric) => ({
    metric,
    label: METRIC_LABELS[metric],
    before: before[metric],
    after: after[metric],
    unit: metricUnit(metric),
  })).filter((c) => c.before !== c.after);
}

function simulateDecision(
  state: SimulationState,
  decision: Decision,
): { next: SimulationState; result: DecisionResult } {
  const working = cloneState(state);
  const beforeMetrics = { ...state.metrics };

  const outcome = applyDecisionMutation(working, decision);

  // Conditional post-mutation: high resources + blocked → unblock (also in increase_resources)
  let mutated = outcome.state;
  if (conditions.highResources(mutated) && conditions.hasBlockedTasks(mutated)) {
    mutated = {
      ...mutated,
      tasks: mutated.tasks.map((t) =>
        t.status === 'blocked' ? { ...t, status: 'in_progress' as const } : t,
      ),
    };
  }

  const withEvents: SimulationState = {
    ...mutated,
    events: [...outcome.events, ...state.events],
    lastDecisionId: decision.id,
    lastConsequence: consequenceSummaries(outcome.consequences).join(' '),
    decisionsHistory: [...state.decisionsHistory, decision.id],
  };

  const finalized = finalizeState(withEvents);
  const after = { ...finalized.metrics };
  const changes = buildChanges(beforeMetrics, after);
  const recentChanges = recentChangesFromMetrics(beforeMetrics, after);

  const emergent = detectEmergentEvents(state, finalized, beforeMetrics, after);

  const impactSummary = changes
    .filter((c) =>
      ['successProbability', 'risk', 'timePressure', 'openTasks', 'remainingDays'].includes(
        c.metric,
      ),
    )
    .slice(0, 3)
    .map((c) => {
      const delta = c.after - c.before;
      const sign = delta > 0 ? '+' : '';
      const suffix = c.unit === '%' ? '%' : c.unit === 'days' ? ' days' : '';
      return `${c.label} ${sign}${delta}${suffix}`;
    })
    .join(' · ');

  const summaryEvent = generateSimulationEvent({
    day: finalized.day,
    eventType: 'metric_change',
    title: 'Metrics recalculated',
    description: `After "${decision.title}", simulation pressures were recomputed.`,
    impact: impactSummary || 'No metric deltas',
    relatedDecisionId: decision.id,
    relatedDecisionTitle: decision.title,
    seq: 90 + state.decisionsHistory.length,
  });

  const result: DecisionResult = {
    decisionId: decision.id,
    decisionTitle: decision.title,
    decisionDescription: decision.description,
    category: decision.category,
    before: beforeMetrics,
    after,
    changes,
    consequences: outcome.consequences,
    consequenceSummaries: consequenceSummaries(outcome.consequences),
    events: [...outcome.events, ...emergent, summaryEvent],
    impactChain: outcome.impactChain,
    estimatedImpact: decision.estimatedImpact,
    possibleRisks: decision.possibleRisks,
  };

  const next: SimulationState = {
    ...finalized,
    events: [summaryEvent, ...emergent, ...finalized.events],
    lastResult: result,
    recentChanges,
    narrative: generateNarrative({ ...finalized, recentChanges }),
    simulationVersion: state.simulationVersion + 1,
  };

  return { next, result };
}

/** Preview consequences without mutating the live simulation. */
export function previewDecision(
  state: SimulationState,
  decisionId: string,
): DecisionResult | null {
  const decision = state.availableDecisions.find((d) => d.id === decisionId);
  if (!decision || !decision.available) return null;
  const { result } = simulateDecision(state, decision);
  return result;
}

/** Apply a decision and return the new simulation state (does not advance the day). */
export function applyDecision(
  state: SimulationState,
  decisionId: string,
): SimulationState {
  const decision = state.availableDecisions.find((d) => d.id === decisionId);
  if (!decision || !decision.available) return state;
  const { next } = simulateDecision(state, decision);
  return next;
}

/** Recompute metrics / status from the current world (no decision). */
export function simulate(state: SimulationState): SimulationState {
  const cloned = cloneState(state);
  return finalizeState(cloned);
}

export function simulateConsequences(
  state: SimulationState,
  decisionId: string,
): DecisionResult | null {
  return previewDecision(state, decisionId);
}

/**
 * Advance the simulation by one day — deterministic.
 * Tasks progress from team capacity; risks evolve; events may fire; metrics recalculate.
 */
export function advanceDay(state: SimulationState): SimulationState {
  if (state.day >= state.deadlineDays) {
    return state;
  }

  const beforeMetrics = { ...state.metrics };
  const day = state.day + 1;
  const teamCapacity = state.metrics.teamCapacity;
  const dailyThroughput = Math.max(0.35, teamCapacity / 85) * Math.max(1, state.team.length) * 0.4;

  let remainingThroughput = dailyThroughput;
  const tasks = state.tasks.map((task) => {
    if (task.status === 'pending' && day >= task.dayStart) {
      return { ...task, status: 'in_progress' as const };
    }
    if (task.status === 'in_progress') {
      const progress = Math.min(task.estimatedDays, remainingThroughput * (task.priority === 'high' ? 1.15 : 1));
      remainingThroughput = Math.max(0, remainingThroughput - progress);
      const newEst = task.estimatedDays - progress;
      if (newEst <= 0.2 || (day >= task.dayEnd && teamCapacity >= 45)) {
        return { ...task, estimatedDays: Math.max(0, newEst), status: 'completed' as const };
      }
      // Overload: stretch end date slightly
      if (teamCapacity < 35 && day >= task.dayEnd - 1) {
        return {
          ...task,
          estimatedDays: Math.max(0.25, newEst),
          dayEnd: Math.min(state.deadlineDays, task.dayEnd + 1),
        };
      }
      return { ...task, estimatedDays: Math.max(0.25, newEst) };
    }
    return task;
  });

  // Ramp onboarded contractors toward full capacity each day
  const team = state.team.map((m) => {
    if (m.capacity < 75 && m.role.toLowerCase().includes('contractor')) {
      return { ...m, capacity: clamp(m.capacity + 8, 35, 85) };
    }
    return m;
  });

  // Soft resource burn each day
  const resources = state.resources.map((r) => {
    if (r.type === 'budget' || r.type === 'time') {
      const burn = Math.max(1, Math.round(r.amount * 0.02));
      return { ...r, remaining: Math.max(0, r.remaining - burn) };
    }
    return r;
  });

  let draft: SimulationState = {
    ...state,
    day,
    tasks,
    team,
    resources,
  };

  const interimMetrics = computeMetrics(draft);
  draft = {
    ...draft,
    risks: evolveRisks(draft, interimMetrics),
  };

  const completedNow = tasks.filter((t) => {
    const prev = state.tasks.find((p) => p.id === t.id);
    return t.status === 'completed' && prev?.status !== 'completed';
  });

  const dayEvent =
    completedNow.length > 0
      ? generateSimulationEvent({
          day,
          eventType: 'task_change',
          title: 'Tasks completed',
          description: completedNow.map((t) => t.title).join('; '),
          impact: `${completedNow.length} task(s) closed`,
          seq: 0,
        })
      : generateSimulationEvent({
          day,
          eventType: 'day_advanced',
          title: 'Day advanced',
          description: `Simulation moved to day ${day}. Team throughput applied to in-progress work.`,
          impact: `${remainingDaysOf(day, state.deadlineDays)} days remaining`,
          seq: 0,
        });

  const finalized = finalizeState({
    ...draft,
    events: [dayEvent, ...state.events],
    lastConsequence: `Advanced to day ${day}.`,
  });

  const emergent = detectEmergentEvents(state, finalized, beforeMetrics, finalized.metrics);
  const recentChanges = recentChangesFromMetrics(beforeMetrics, finalized.metrics);

  return {
    ...finalized,
    events: [...emergent, ...finalized.events],
    recentChanges,
    narrative: generateNarrative({ ...finalized, recentChanges }),
    simulationVersion: state.simulationVersion + 1,
  };
}

/** Direct world mutations — designed as future WebMCP tool targets. */
export function changeDeadline(
  state: SimulationState,
  newDeadlineDays: number,
): SimulationState {
  const deadlineDays = Math.max(1, Math.round(newDeadlineDays));
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'system',
    title: 'Deadline changed',
    description: `Deadline set to ${deadlineDays} days.`,
    impact: `${state.deadlineDays} → ${deadlineDays} days`,
  });
  return bumpVersion(
    finalizeState({
      ...state,
      deadlineDays,
      events: [event, ...state.events],
    }),
  );
}

export function addTask(
  state: SimulationState,
  input: Omit<Task, 'id'> & { id?: string },
): SimulationState {
  const task: Task = {
    ...input,
    id: input.id ?? createId('task'),
  };
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'task_change',
    title: 'Task added',
    description: task.title,
    impact: `Open tasks → ${state.metrics.openTasks + (task.status === 'completed' ? 0 : 1)}`,
  });
  return bumpVersion(
    finalizeState({
      ...state,
      tasks: [...state.tasks, task],
      events: [event, ...state.events],
    }),
  );
}

export function removeTask(state: SimulationState, taskId: string): SimulationState {
  const target = state.tasks.find((t) => t.id === taskId);
  if (!target) return state;
  if (target.status === 'completed') {
    return state;
  }
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'task_change',
    title: 'Task removed',
    description: target.title,
    impact: '−1 task',
  });
  return bumpVersion(
    finalizeState({
      ...state,
      tasks: state.tasks.filter((t) => t.id !== taskId),
      events: [event, ...state.events],
    }),
  );
}

export function addResource(
  state: SimulationState,
  input: Omit<Resource, 'id'> & { id?: string },
): SimulationState {
  const resource: Resource = {
    ...input,
    id: input.id ?? createId('res'),
  };
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'resource_change',
    title: 'Resource added',
    description: `${resource.name} (${resource.remaining} ${resource.unit})`,
    impact: '+1 resource pool',
  });
  return bumpVersion(
    finalizeState({
      ...state,
      resources: [...state.resources, resource],
      events: [event, ...state.events],
    }),
  );
}

export function addTeamMember(
  state: SimulationState,
  input: Omit<TeamMember, 'id'> & { id?: string },
): SimulationState {
  const member: TeamMember = {
    ...input,
    id: input.id ?? createId('tm'),
    skills: [...input.skills],
  };
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'team_change',
    title: 'Team member added',
    description: `${member.name} · ${member.role}`,
    impact: `Team ${state.team.length} → ${state.team.length + 1}`,
  });
  return bumpVersion(
    finalizeState({
      ...state,
      team: [...state.team, member],
      events: [event, ...state.events],
    }),
  );
}

export function getSimulationState(state: SimulationState): SimulationState {
  return state;
}

export { generateSimulationEvent };
export { getAvailableDecisions } from './decisions';
export { METRIC_LABELS };
export type { EventType };
