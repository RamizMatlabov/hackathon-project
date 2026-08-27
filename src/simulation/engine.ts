import type {
  Decision,
  DecisionCategory,
  DecisionKind,
  DecisionResult,
  EventType,
  ImpactLevel,
  ImpactStep,
  MetricChange,
  MetricKey,
  Resource,
  Risk,
  RiskSeverity,
  Scenario,
  SimulationEvent,
  SimulationMetrics,
  SimulationState,
  SimulationStatus,
  Task,
  TeamMember,
} from '../types';
import { SAMPLE_RISKS, SAMPLE_TASKS } from '../data/mockScenarios';
import {
  clamp,
  createId,
  rankToSeverity,
  severityRank,
} from '../utils/helpers';

const METRIC_LABELS: Record<MetricKey, string> = {
  successProbability: 'Success probability',
  risk: 'Risk',
  timePressure: 'Time pressure',
  resourcePressure: 'Resource pressure',
  teamCapacity: 'Team capacity',
  openTasks: 'Open tasks',
  remainingDays: 'Days remaining',
  teamSize: 'Team size',
};

const KIND_CATEGORY: Record<DecisionKind, DecisionCategory> = {
  reduce_scope: 'scope',
  add_team_member: 'team',
  move_deadline: 'schedule',
  remove_task: 'tasks',
  increase_resources: 'resources',
};

function remainingDaysOf(day: number, deadlineDays: number): number {
  return Math.max(0, deadlineDays - day);
}

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
    const severityWeight = (severityRank(risk.severity) + 1) / 4;
    return sum + risk.probability * severityWeight * 100;
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
): number {
  let score = 88;
  score -= risk * 0.38;
  score -= timePressure * 0.28;
  score -= resourcePressure * 0.14;
  score += teamCapacity * 0.18;
  score -= Math.max(0, openTasks - remainingDays) * 2.5;

  if (riskTolerance === 'low') score -= 3;
  if (riskTolerance === 'high') score += 3;
  if (remainingDays <= 2 && openTasks > 2) score -= 10;

  return clamp(Math.round(score), 8, 96);
}

export function computeMetrics(state: Pick<
  SimulationState,
  | 'day'
  | 'deadlineDays'
  | 'tasks'
  | 'risks'
  | 'resources'
  | 'team'
  | 'riskTolerance'
>): SimulationMetrics {
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
  const risk = calculateRisk(state.risks, timePressure, openTasks);
  const successProbability = calculateSuccessProbability(
    risk,
    timePressure,
    resourcePressure,
    teamCapacity,
    state.riskTolerance,
    openTasks,
    remainingDays,
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
  };
}

function deriveStatus(metrics: SimulationMetrics, risks: Risk[]): SimulationStatus {
  const hasCritical = risks.some((r) => r.severity === 'critical');
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

export function generateSimulationEvent(input: {
  day: number;
  eventType: EventType;
  title: string;
  description: string;
  impact: string;
  relatedDecisionId?: string | null;
  relatedDecisionTitle?: string | null;
}): SimulationEvent {
  const categoryMap: Record<EventType, SimulationEvent['category']> = {
    system: 'system',
    decision_applied: 'decision',
    risk_change: 'risk',
    resource_change: 'resource',
    team_change: 'team',
    task_change: 'task',
    metric_change: 'system',
    day_advanced: 'system',
  };

  return {
    id: createId('evt'),
    timestamp: Date.now(),
    day: input.day,
    eventType: input.eventType,
    title: input.title,
    description: input.description,
    impact: input.impact,
    relatedDecisionId: input.relatedDecisionId ?? null,
    relatedDecisionTitle: input.relatedDecisionTitle ?? null,
    category: categoryMap[input.eventType],
  };
}

function shiftRiskSeverities(risks: Risk[], delta: number): Risk[] {
  return risks.map((risk) => {
    const next = clamp(severityRank(risk.severity) + delta, 0, 3);
    return {
      ...risk,
      severity: rankToSeverity(next) as RiskSeverity,
      probability: clamp(risk.probability + delta * 0.08, 0.05, 0.95),
    };
  });
}

function decisionEffects(kind: DecisionKind, state: SimulationState): Decision['effects'] {
  switch (kind) {
    case 'reduce_scope':
      return [
        { target: 'tasks', description: 'Remove non-critical deliverables', direction: 'decrease' },
        { target: 'timePressure', description: 'Lower schedule load', direction: 'decrease' },
        { target: 'risk', description: 'Reduce scope-creep exposure', direction: 'decrease' },
      ];
    case 'add_team_member':
      return [
        { target: 'team', description: 'Add contractor capacity', direction: 'increase' },
        { target: 'teamCapacity', description: 'Raise available capacity', direction: 'increase' },
        { target: 'resources', description: 'Consume budget', direction: 'decrease' },
      ];
    case 'move_deadline': {
      const compressing = (state.deadlineDays > 4);
      return compressing
        ? [
            { target: 'deadline', description: 'Compress remaining schedule', direction: 'decrease' },
            { target: 'timePressure', description: 'Raise schedule pressure', direction: 'increase' },
            { target: 'risk', description: 'Elevate delivery risk', direction: 'increase' },
          ]
        : [
            { target: 'deadline', description: 'Extend go-live window', direction: 'increase' },
            { target: 'timePressure', description: 'Ease schedule pressure', direction: 'decrease' },
            { target: 'risk', description: 'Lower delivery risk', direction: 'decrease' },
          ];
    }
    case 'remove_task':
      return [
        { target: 'tasks', description: 'Drop a selected work item', direction: 'decrease' },
        { target: 'timePressure', description: 'Free critical-path capacity', direction: 'decrease' },
        { target: 'successProbability', description: 'Improve odds of landing', direction: 'increase' },
      ];
    case 'increase_resources':
      return [
        { target: 'resources', description: 'Add budget and buffer days', direction: 'increase' },
        { target: 'resourcePressure', description: 'Relieve spend/time pressure', direction: 'decrease' },
        { target: 'risk', description: 'Improve mitigation headroom', direction: 'decrease' },
      ];
  }
}

function decisionRisks(kind: DecisionKind): string[] {
  switch (kind) {
    case 'reduce_scope':
      return ['Stakeholder pushback on cut features', 'Perceived quality reduction'];
    case 'add_team_member':
      return ['Onboarding drag', 'Budget overrun', 'Coordination overhead'];
    case 'move_deadline':
      return ['Quality shortcuts', 'Team burnout', 'Missed dependency windows'];
    case 'remove_task':
      return ['Hidden dependency breakage', 'Support gaps after launch'];
    case 'increase_resources':
      return ['Diminishing returns', 'Approval delay for spend'];
  }
}

function estimatedImpactFor(kind: DecisionKind, state: SimulationState): ImpactLevel {
  if (kind === 'move_deadline' && state.deadlineDays > 4) return 'high';
  if (kind === 'reduce_scope') return 'medium';
  if (kind === 'add_team_member') return 'medium';
  if (kind === 'increase_resources') return 'medium';
  return 'low';
}

function buildDecision(
  kind: DecisionKind,
  state: SimulationState,
  partial: Pick<Decision, 'title' | 'description' | 'available'> & {
    payload?: Record<string, unknown>;
  },
): Decision {
  return {
    // Stable per kind so preview selection survives metric recomputes.
    id: `dec_${kind}`,
    kind,
    category: KIND_CATEGORY[kind],
    effects: decisionEffects(kind, state),
    possibleRisks: decisionRisks(kind),
    estimatedImpact: estimatedImpactFor(kind, state),
    ...partial,
  };
}

function refreshDecisions(state: SimulationState): Decision[] {
  const removable = state.tasks.find(
    (t) =>
      t.status === 'pending' ||
      t.status === 'blocked' ||
      t.status === 'needs_restructure',
  );
  const deadlineAlreadyTight = state.deadlineDays <= 4;

  return [
    buildDecision('reduce_scope', state, {
      title: 'Reduce scope',
      description: 'Cut non-critical deliverables to protect the launch window.',
      available: state.tasks.some((t) => t.priority !== 'high' && t.status !== 'completed'),
    }),
    buildDecision('add_team_member', state, {
      title: 'Add team member',
      description: 'Bring in a contractor to absorb overloaded workstreams.',
      available: state.team.length < 6,
      payload: {
        name: 'Casey Brooks',
        role: 'Full-stack Contractor',
        capacity: 80,
        skills: ['React', 'APIs', 'QA'],
      },
    }),
    buildDecision('move_deadline', state, {
      title: deadlineAlreadyTight ? 'Extend deadline by 3 days' : 'Move deadline to 4 days',
      description: deadlineAlreadyTight
        ? 'Buy back schedule by pushing the go-live window.'
        : 'Compress the timeline aggressively to an earlier go-live.',
      available: true,
      payload: {
        newDeadlineDays: deadlineAlreadyTight ? state.deadlineDays + 3 : 4,
      },
    }),
    buildDecision('remove_task', state, {
      title: removable ? `Remove task: ${removable.title}` : 'Remove a pending task',
      description: 'Drop a lower-priority item to free capacity.',
      available: Boolean(removable),
      payload: { taskId: removable?.id },
    }),
    buildDecision('increase_resources', state, {
      title: 'Increase resources',
      description: 'Allocate additional budget and schedule buffer.',
      available: true,
      payload: { budgetDelta: 8000, bufferDays: 2 },
    }),
  ];
}

function finalizeState(state: SimulationState): SimulationState {
  const metrics = computeMetrics(state);
  return {
    ...state,
    remainingDays: metrics.remainingDays,
    successProbability: metrics.successProbability,
    metrics,
    status: deriveStatus(metrics, state.risks),
    availableDecisions: refreshDecisions({ ...state, metrics }),
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
    lastResult: state.lastResult
      ? {
          ...state.lastResult,
          before: { ...state.lastResult.before },
          after: { ...state.lastResult.after },
          changes: state.lastResult.changes.map((c) => ({ ...c })),
          consequences: [...state.lastResult.consequences],
          events: state.lastResult.events.map((e) => ({ ...e })),
          impactChain: state.lastResult.impactChain.map((s) => ({ ...s })),
          possibleRisks: [...state.lastResult.possibleRisks],
        }
      : null,
  };
}

export function createSimulationFromScenario(scenario: Scenario): SimulationState {
  const team = scenario.team.map((m) => ({ ...m, skills: [...m.skills] }));
  const tasks = SAMPLE_TASKS.map((t, index) => ({
    ...t,
    id: createId('task'),
    assigneeId: team[index % team.length]?.id ?? null,
    dayEnd: Math.min(t.dayEnd, scenario.deadlineDays),
    dayStart: Math.min(t.dayStart, Math.max(1, scenario.deadlineDays - 1)),
  }));
  const risks = SAMPLE_RISKS.map((r) => ({ ...r, id: createId('risk') }));

  const draft: SimulationState = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    goal: {
      ...scenario.goal,
      successCriteria: [...scenario.goal.successCriteria],
    },
    day: 1,
    deadlineDays: scenario.deadlineDays,
    remainingDays: remainingDaysOf(1, scenario.deadlineDays),
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
  };

  const metrics = computeMetrics(draft);
  const events: SimulationEvent[] = [
    generateSimulationEvent({
      day: 1,
      eventType: 'system',
      title: 'Simulation initialized',
      description: `${scenario.name} is live. Goal: ${scenario.goal.title}.`,
      impact: `Baseline success probability ${metrics.successProbability}%`,
    }),
    generateSimulationEvent({
      day: 1,
      eventType: 'risk_change',
      title: 'Baseline risks assessed',
      description: `${risks.length} active risks scored against current constraints.`,
      impact: `Risk index ${metrics.risk}% · Time pressure ${metrics.timePressure}%`,
    }),
    generateSimulationEvent({
      day: 1,
      eventType: 'task_change',
      title: 'Workstream loaded',
      description: `${tasks.length} tasks placed on the timeline across ${scenario.team.length} team members.`,
      impact: `${metrics.openTasks} open tasks · ${metrics.remainingDays} days remaining`,
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

interface MutationOutcome {
  state: SimulationState;
  consequences: string[];
  events: SimulationEvent[];
  impactChain: ImpactStep[];
}

function applyReduceScope(state: SimulationState, decision: Decision): MutationOutcome {
  const candidates = state.tasks.filter(
    (t) => t.priority !== 'high' && t.status !== 'completed',
  );
  const removed = candidates.slice(0, 2);
  const removedIds = new Set(removed.map((t) => t.id));
  const tasks = state.tasks.filter((t) => !removedIds.has(t.id));
  const risks = shiftRiskSeverities(state.risks, -1).map((r) =>
    r.title === 'Scope creep before launch'
      ? {
          ...r,
          severity: 'low' as RiskSeverity,
          probability: clamp(r.probability - 0.2, 0.05, 0.95),
        }
      : r,
  );

  const consequences =
    removed.length > 0
      ? [
          `Dropped ${removed.length} non-critical task(s): ${removed.map((t) => t.title).join('; ')}.`,
          'Scope-creep exposure eased; schedule load should fall.',
        ]
      : ['No non-critical tasks remained to cut.'];

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Scope reduced',
      description: consequences[0],
      impact: removed.length > 0 ? `−${removed.length} tasks` : 'No task change',
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
  ];

  if (removed.length > 0) {
    events.push(
      generateSimulationEvent({
        day: state.day,
        eventType: 'task_change',
        title: 'Tasks removed from plan',
        description: removed.map((t) => t.title).join('; '),
        impact: `Open tasks ${state.metrics.openTasks} → ${openTasksOf(tasks).length}`,
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
    );
  }

  return {
    state: { ...state, tasks, risks },
    consequences,
    events,
    impactChain: [
      { kind: 'decision', label: decision.title, detail: decision.description },
      {
        kind: 'direct',
        label: removed.length > 0 ? `−${removed.length} tasks` : 'No tasks cut',
        detail: removed.map((t) => t.title).join(', ') || undefined,
      },
      { kind: 'secondary', label: 'Lower time pressure', detail: 'Less work competing for the same window' },
      { kind: 'secondary', label: 'Lower risk', detail: 'Scope creep and overload ease' },
      { kind: 'outcome', label: 'Higher success probability', detail: 'Delivery odds improve' },
    ],
  };
}

function applyAddTeamMember(state: SimulationState, decision: Decision): MutationOutcome {
  const payload = decision.payload ?? {};
  const member: TeamMember = {
    id: createId('tm'),
    name: String(payload.name ?? 'New Contractor'),
    role: String(payload.role ?? 'Contractor'),
    capacity: Number(payload.capacity ?? 75),
    skills: Array.isArray(payload.skills) ? (payload.skills as string[]) : ['general'],
  };

  const tasks = state.tasks.map((task) => {
    if (task.status === 'blocked' || task.status === 'needs_restructure') {
      return { ...task, status: 'in_progress' as const, assigneeId: member.id };
    }
    return task;
  });

  const resources = state.resources.map((r) =>
    r.type === 'budget' ? { ...r, remaining: Math.max(0, r.remaining - 4500) } : r,
  );

  const risks = shiftRiskSeverities(state.risks, -1);
  const consequences = [
    `${member.name} joined as ${member.role}.`,
    'Blocked / restructure work reassigned; budget reduced by 4,500.',
  ];

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Team expanded',
      description: consequences[0],
      impact: `Team ${state.team.length} → ${state.team.length + 1}`,
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
    generateSimulationEvent({
      day: state.day,
      eventType: 'team_change',
      title: 'Capacity injected',
      description: `${member.name} absorbing blocked workstreams.`,
      impact: 'Blocked tasks moved to in progress',
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
    generateSimulationEvent({
      day: state.day,
      eventType: 'resource_change',
      title: 'Budget consumed',
      description: 'Contractor cost drawn from project budget.',
      impact: '−4,500 USD remaining budget',
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
  ];

  return {
    state: {
      ...state,
      team: [...state.team, member],
      tasks,
      resources,
      risks,
    },
    consequences,
    events,
    impactChain: [
      { kind: 'decision', label: decision.title, detail: decision.description },
      { kind: 'direct', label: '+1 team member', detail: `${member.name} · ${member.role}` },
      { kind: 'direct', label: 'Blocked work unblocked', detail: 'Reassigned to new capacity' },
      { kind: 'secondary', label: 'Higher team capacity', detail: 'More parallel throughput' },
      { kind: 'secondary', label: 'Slight resource pressure', detail: 'Budget drawdown' },
      { kind: 'outcome', label: 'Improved delivery odds', detail: 'Success probability typically rises' },
    ],
  };
}

function applyMoveDeadline(state: SimulationState, decision: Decision): MutationOutcome {
  const newDeadline = Number(decision.payload?.newDeadlineDays ?? state.deadlineDays);
  const compressing = newDeadline < state.deadlineDays;

  let tasks = state.tasks;
  let risks = state.risks;
  const consequences: string[] = [];
  const events: SimulationEvent[] = [];
  let impactChain: ImpactStep[];

  if (compressing) {
    tasks = state.tasks.map((task) => {
      if (task.status === 'completed') return task;
      if (task.dayEnd > newDeadline || task.priority === 'medium') {
        return {
          ...task,
          status: 'needs_restructure' as const,
          dayEnd: Math.min(task.dayEnd, newDeadline),
          priority: task.priority === 'low' ? 'medium' : task.priority === 'medium' ? 'high' : task.priority,
        };
      }
      return { ...task, dayEnd: Math.min(task.dayEnd, newDeadline) };
    });

    risks = shiftRiskSeverities(state.risks, 1).map((r) => ({
      ...r,
      probability: clamp(r.probability + 0.12, 0.05, 0.95),
    }));

    if (!risks.some((r) => r.title === 'Compressed deadline pressure')) {
      risks = [
        {
          id: createId('risk'),
          title: 'Compressed deadline pressure',
          description: 'Aggressive timeline leaves little room for defects or review lag.',
          severity: 'critical',
          probability: 0.72,
          mitigation: 'Cut scope or restore schedule buffer immediately.',
        },
        ...risks,
      ];
    }

    const criticalized = tasks.filter((t) => t.status === 'needs_restructure').length;
    consequences.push(
      `Deadline moved from ${state.deadlineDays} to ${newDeadline} days.`,
      `${criticalized} task(s) marked needs restructure; risk elevated.`,
    );

    events.push(
      generateSimulationEvent({
        day: state.day,
        eventType: 'decision_applied',
        title: 'Deadline compressed',
        description: consequences[0],
        impact: `Days remaining ${state.metrics.remainingDays} → ${remainingDaysOf(state.day, newDeadline)}`,
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
      generateSimulationEvent({
        day: state.day,
        eventType: 'risk_change',
        title: 'Schedule risk spiked',
        description: 'Compressed deadline pressure introduced as a critical risk.',
        impact: 'Risk severity increased across active risks',
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
      generateSimulationEvent({
        day: state.day,
        eventType: 'task_change',
        title: 'Tasks became critical',
        description: `${criticalized} tasks require restructuring to fit the new window.`,
        impact: 'Several work items flagged needs_restructure',
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
    );

    impactChain = [
      { kind: 'decision', label: decision.title, detail: decision.description },
      {
        kind: 'direct',
        label: `Deadline → ${newDeadline} days`,
        detail: `From ${state.deadlineDays} days`,
      },
      { kind: 'direct', label: 'Tasks turn critical', detail: 'Overlap forces restructure' },
      { kind: 'secondary', label: 'Higher time pressure', detail: 'Same work, less calendar' },
      { kind: 'secondary', label: 'Higher risk', detail: 'Critical schedule exposure' },
      { kind: 'outcome', label: 'Lower success probability', detail: 'Delivery odds drop unless scope changes' },
    ];
  } else {
    tasks = state.tasks.map((task) =>
      task.status === 'needs_restructure' ? { ...task, status: 'in_progress' as const } : task,
    );
    risks = shiftRiskSeverities(
      state.risks.filter((r) => r.title !== 'Compressed deadline pressure'),
      -1,
    );
    consequences.push(
      `Deadline extended to ${newDeadline} days.`,
      'Schedule pressure eased; restructuring flags cleared.',
    );
    events.push(
      generateSimulationEvent({
        day: state.day,
        eventType: 'decision_applied',
        title: 'Deadline extended',
        description: consequences[0],
        impact: `Deadline ${state.deadlineDays} → ${newDeadline} days`,
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
    );
    impactChain = [
      { kind: 'decision', label: decision.title, detail: decision.description },
      { kind: 'direct', label: `Deadline → ${newDeadline} days`, detail: 'More calendar buffer' },
      { kind: 'secondary', label: 'Lower time pressure', detail: 'Workload spreads out' },
      { kind: 'secondary', label: 'Lower risk', detail: 'Critical deadline risk cleared' },
      { kind: 'outcome', label: 'Higher success probability', detail: 'Delivery odds recover' },
    ];
  }

  return {
    state: { ...state, deadlineDays: newDeadline, tasks, risks },
    consequences,
    events,
    impactChain,
  };
}

function applyRemoveTask(state: SimulationState, decision: Decision): MutationOutcome {
  const taskId = String(decision.payload?.taskId ?? '');
  const target =
    state.tasks.find((t) => t.id === taskId) ??
    state.tasks.find((t) => t.status !== 'completed');

  if (!target) {
    const consequences = ['No removable task found.'];
    const events = [
      generateSimulationEvent({
        day: state.day,
        eventType: 'task_change',
        title: 'Task removal skipped',
        description: consequences[0],
        impact: 'No change',
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
    ];
    return {
      state,
      consequences,
      events,
      impactChain: [
        { kind: 'decision', label: decision.title },
        { kind: 'direct', label: 'No task removed' },
        { kind: 'outcome', label: 'State unchanged' },
      ],
    };
  }

  const tasks = state.tasks.filter((t) => t.id !== target.id);
  const risks = shiftRiskSeverities(state.risks, -1);
  const consequences = [
    `Removed "${target.title}" from the plan.`,
    'Capacity freed for critical-path work.',
  ];
  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Task removed',
      description: consequences[0],
      impact: `Open tasks ${state.metrics.openTasks} → ${openTasksOf(tasks).length}`,
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
  ];

  return {
    state: { ...state, tasks, risks },
    consequences,
    events,
    impactChain: [
      { kind: 'decision', label: decision.title, detail: decision.description },
      { kind: 'direct', label: '−1 task', detail: target.title },
      { kind: 'secondary', label: 'Lower time pressure', detail: 'Less competing work' },
      { kind: 'secondary', label: 'Lower risk', detail: 'Fewer failure points' },
      { kind: 'outcome', label: 'Higher success probability', detail: 'Focus on remaining critical path' },
    ],
  };
}

function applyIncreaseResources(
  state: SimulationState,
  decision: Decision,
): MutationOutcome {
  const budgetDelta = Number(decision.payload?.budgetDelta ?? 5000);
  const bufferDays = Number(decision.payload?.bufferDays ?? 1);

  const resources = state.resources.map((r) => {
    if (r.type === 'budget') {
      return {
        ...r,
        amount: r.amount + budgetDelta,
        remaining: r.remaining + budgetDelta,
      };
    }
    if (r.type === 'time') {
      return {
        ...r,
        amount: r.amount + bufferDays,
        remaining: r.remaining + bufferDays,
      };
    }
    return r;
  });

  const tasks = state.tasks.map((t) =>
    t.status === 'blocked' ? { ...t, status: 'in_progress' as const } : t,
  );
  const risks = shiftRiskSeverities(state.risks, -1);

  const consequences = [
    `Added ${budgetDelta.toLocaleString()} USD and ${bufferDays} buffer day(s).`,
    'Blocked work resumed where resources were the bottleneck.',
  ];

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Resources increased',
      description: consequences[0],
      impact: `+${budgetDelta.toLocaleString()} USD · +${bufferDays} buffer day(s)`,
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
    generateSimulationEvent({
      day: state.day,
      eventType: 'resource_change',
      title: 'Capacity headroom restored',
      description: 'Budget and schedule buffer expanded.',
      impact: 'Resource pressure expected to fall',
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
  ];

  return {
    state: { ...state, resources, tasks, risks },
    consequences,
    events,
    impactChain: [
      { kind: 'decision', label: decision.title, detail: decision.description },
      {
        kind: 'direct',
        label: 'More budget & buffer',
        detail: `+${budgetDelta.toLocaleString()} USD · +${bufferDays} days`,
      },
      { kind: 'secondary', label: 'Lower resource pressure', detail: 'Spend and time headroom' },
      { kind: 'secondary', label: 'Lower risk', detail: 'Mitigation options expand' },
      { kind: 'outcome', label: 'Higher success probability', detail: 'Constraints loosen' },
    ],
  };
}

const handlers: Record<
  DecisionKind,
  (state: SimulationState, decision: Decision) => MutationOutcome
> = {
  reduce_scope: applyReduceScope,
  add_team_member: applyAddTeamMember,
  move_deadline: applyMoveDeadline,
  remove_task: applyRemoveTask,
  increase_resources: applyIncreaseResources,
};

const TRACKED_METRICS: MetricKey[] = [
  'successProbability',
  'risk',
  'timePressure',
  'resourcePressure',
  'teamCapacity',
  'openTasks',
  'remainingDays',
  'teamSize',
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
  advanceDayOnApply: boolean,
): { next: SimulationState; result: DecisionResult } {
  const working = cloneState(state);
  const day = advanceDayOnApply
    ? Math.min(working.day + 1, working.deadlineDays)
    : working.day;
  working.day = day;

  const outcome = handlers[decision.kind](working, decision);
  const withEvents: SimulationState = {
    ...outcome.state,
    day,
    events: [...outcome.events, ...state.events],
    lastDecisionId: decision.id,
    lastConsequence: outcome.consequences.join(' '),
    decisionsHistory: [...state.decisionsHistory, decision.id],
  };

  const finalized = finalizeState(withEvents);
  const before = { ...state.metrics };
  const after = { ...finalized.metrics };
  const changes = buildChanges(before, after);

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
    day,
    eventType: 'metric_change',
    title: 'Metrics recalculated',
    description: `After "${decision.title}", simulation pressures were recomputed.`,
    impact: impactSummary || 'No metric deltas',
    relatedDecisionId: decision.id,
    relatedDecisionTitle: decision.title,
  });

  const result: DecisionResult = {
    decisionId: decision.id,
    decisionTitle: decision.title,
    decisionDescription: decision.description,
    category: decision.category,
    before,
    after,
    changes,
    consequences: outcome.consequences,
    events: [...outcome.events, summaryEvent],
    impactChain: outcome.impactChain,
    estimatedImpact: decision.estimatedImpact,
    possibleRisks: decision.possibleRisks,
  };

  const next: SimulationState = {
    ...finalized,
    events: [summaryEvent, ...finalized.events],
    lastResult: result,
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

  // Preview advances the day the same way apply does, but returns only the result.
  const { result } = simulateDecision(state, decision, true);
  return result;
}

/** Apply a decision and return the new simulation state. */
export function applyDecision(
  state: SimulationState,
  decisionId: string,
): SimulationState {
  const decision = state.availableDecisions.find((d) => d.id === decisionId);
  if (!decision || !decision.available) return state;

  const { next } = simulateDecision(state, decision, true);
  return next;
}

/** Recompute metrics / status from the current world (no decision). */
export function simulate(state: SimulationState): SimulationState {
  return finalizeState(cloneState(state));
}

export function simulateConsequences(
  state: SimulationState,
  decisionId: string,
): DecisionResult | null {
  return previewDecision(state, decisionId);
}

export function advanceDay(state: SimulationState): SimulationState {
  if (state.day >= state.deadlineDays) {
    return state;
  }

  const day = state.day + 1;
  const tasks = state.tasks.map((task) => {
    if (task.status === 'in_progress' && day >= task.dayEnd) {
      return { ...task, status: 'completed' as const };
    }
    if (task.status === 'pending' && day >= task.dayStart) {
      return { ...task, status: 'in_progress' as const };
    }
    return task;
  });

  const completedNow = tasks.filter(
    (t, i) => t.status === 'completed' && state.tasks[i]?.status !== 'completed',
  );

  const event =
    completedNow.length > 0
      ? generateSimulationEvent({
          day,
          eventType: 'task_change',
          title: 'Tasks completed',
          description: completedNow.map((t) => t.title).join('; '),
          impact: `${completedNow.length} task(s) closed`,
        })
      : generateSimulationEvent({
          day,
          eventType: 'day_advanced',
          title: 'Day advanced',
          description: `Simulation moved to day ${day}.`,
          impact: `${remainingDaysOf(day, state.deadlineDays)} days remaining`,
        });

  return finalizeState({
    ...state,
    day,
    tasks,
    events: [event, ...state.events],
    lastConsequence: `Advanced to day ${day}.`,
  });
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
  return finalizeState({
    ...state,
    deadlineDays,
    events: [event, ...state.events],
  });
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
  return finalizeState({
    ...state,
    tasks: [...state.tasks, task],
    events: [event, ...state.events],
  });
}

export function removeTask(state: SimulationState, taskId: string): SimulationState {
  const target = state.tasks.find((t) => t.id === taskId);
  if (!target) return state;
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'task_change',
    title: 'Task removed',
    description: target.title,
    impact: '−1 task',
  });
  return finalizeState({
    ...state,
    tasks: state.tasks.filter((t) => t.id !== taskId),
    events: [event, ...state.events],
  });
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
  return finalizeState({
    ...state,
    resources: [...state.resources, resource],
    events: [event, ...state.events],
  });
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
  return finalizeState({
    ...state,
    team: [...state.team, member],
    events: [event, ...state.events],
  });
}

export function getSimulationState(state: SimulationState): SimulationState {
  return state;
}

export { METRIC_LABELS };
