import type {
  Decision,
  DecisionKind,
  Risk,
  RiskSeverity,
  Scenario,
  SimulationEvent,
  SimulationState,
  SimulationStatus,
  Task,
  TeamMember,
} from '../types';
import {
  SAMPLE_RISKS,
  SAMPLE_TASKS,
} from '../data/mockScenarios';
import {
  clamp,
  createId,
  rankToSeverity,
  severityRank,
} from '../utils/helpers';

function baseProbability(scenario: Scenario, tasks: Task[], risks: Risk[]): number {
  const openHigh = tasks.filter(
    (t) => t.priority === 'high' && t.status !== 'completed',
  ).length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const criticalRisks = risks.filter((r) => r.severity === 'critical' || r.severity === 'high').length;

  let score = 78;
  score -= openHigh * 4;
  score -= blocked * 6;
  score -= criticalRisks * 5;

  if (scenario.deadlineDays <= 5) score -= 8;
  if (scenario.riskTolerance === 'low') score -= 3;
  if (scenario.riskTolerance === 'high') score += 3;
  if (scenario.team.length >= 4) score += 4;
  if (scenario.resources.some((r) => r.type === 'time' && r.remaining >= 2)) score += 3;

  return clamp(score, 18, 94);
}

function deriveStatus(probability: number, risks: Risk[], tasks: Task[]): SimulationStatus {
  const hasCritical = risks.some((r) => r.severity === 'critical');
  const blockedCount = tasks.filter((t) => t.status === 'blocked' || t.status === 'needs_restructure').length;

  if (hasCritical || probability < 35) return 'critical';
  if (blockedCount >= 2 || probability < 55) return 'at_risk';
  return 'on_track';
}

function makeEvent(
  day: number,
  title: string,
  detail: string,
  category: SimulationEvent['category'],
): SimulationEvent {
  return {
    id: createId('evt'),
    timestamp: Date.now(),
    day,
    title,
    detail,
    category,
  };
}

function buildInitialDecisions(tasks: Task[]): Decision[] {
  const removable = tasks.find((t) => t.status === 'pending' || t.status === 'blocked');
  return [
    {
      id: createId('dec'),
      kind: 'reduce_scope',
      title: 'Reduce scope',
      description: 'Cut non-critical deliverables to protect the launch window.',
      available: true,
    },
    {
      id: createId('dec'),
      kind: 'add_team_member',
      title: 'Add another team member',
      description: 'Bring in a contractor to absorb overloaded workstreams.',
      available: true,
      payload: {
        name: 'Casey Brooks',
        role: 'Full-stack Contractor',
        capacity: 80,
        skills: ['React', 'APIs', 'QA'],
      },
    },
    {
      id: createId('dec'),
      kind: 'move_deadline',
      title: 'Move deadline to 4 days',
      description: 'Compress the timeline aggressively to an earlier go-live.',
      available: true,
      payload: { newDeadlineDays: 4 },
    },
    {
      id: createId('dec'),
      kind: 'remove_task',
      title: removable ? `Remove task: ${removable.title}` : 'Remove a pending task',
      description: 'Drop a lower-priority item to free capacity.',
      available: Boolean(removable),
      payload: { taskId: removable?.id },
    },
    {
      id: createId('dec'),
      kind: 'increase_resources',
      title: 'Increase resources',
      description: 'Allocate additional budget and schedule buffer.',
      available: true,
      payload: { budgetDelta: 8000, bufferDays: 2 },
    },
  ];
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

function refreshDecisions(state: SimulationState): Decision[] {
  const removable = state.tasks.find(
    (t) => t.status === 'pending' || t.status === 'blocked' || t.status === 'needs_restructure',
  );
  const deadlineAlreadyTight = state.deadlineDays <= 4;

  return [
    {
      id: createId('dec'),
      kind: 'reduce_scope',
      title: 'Reduce scope',
      description: 'Cut non-critical deliverables to protect the launch window.',
      available: state.tasks.some((t) => t.priority !== 'high' && t.status !== 'completed'),
    },
    {
      id: createId('dec'),
      kind: 'add_team_member',
      title: 'Add another team member',
      description: 'Bring in a contractor to absorb overloaded workstreams.',
      available: state.team.length < 6,
      payload: {
        name: 'Casey Brooks',
        role: 'Full-stack Contractor',
        capacity: 80,
        skills: ['React', 'APIs', 'QA'],
      },
    },
    {
      id: createId('dec'),
      kind: 'move_deadline',
      title: deadlineAlreadyTight ? 'Extend deadline by 3 days' : 'Move deadline to 4 days',
      description: deadlineAlreadyTight
        ? 'Buy back schedule by pushing the go-live window.'
        : 'Compress the timeline aggressively to an earlier go-live.',
      available: true,
      payload: {
        newDeadlineDays: deadlineAlreadyTight
          ? state.deadlineDays + 3
          : 4,
      },
    },
    {
      id: createId('dec'),
      kind: 'remove_task',
      title: removable ? `Remove task: ${removable.title}` : 'Remove a pending task',
      description: 'Drop a lower-priority item to free capacity.',
      available: Boolean(removable),
      payload: { taskId: removable?.id },
    },
    {
      id: createId('dec'),
      kind: 'increase_resources',
      title: 'Increase resources',
      description: 'Allocate additional budget and schedule buffer.',
      available: true,
      payload: { budgetDelta: 8000, bufferDays: 2 },
    },
  ];
}

function scenarioSnapshot(state: SimulationState): Scenario {
  return {
    id: state.scenarioId,
    name: state.scenarioName,
    goal: state.goal,
    deadlineDays: state.deadlineDays,
    resources: state.resources,
    team: state.team,
    constraints: state.constraints,
    riskTolerance: state.riskTolerance,
    createdAt: 0,
    lastOpenedAt: 0,
  };
}

function recompute(state: SimulationState): SimulationState {
  const nextProbability = clamp(
    baseProbability(scenarioSnapshot(state), state.tasks, state.risks),
    12,
    96,
  );

  return {
    ...state,
    successProbability: nextProbability,
    status: deriveStatus(nextProbability, state.risks, state.tasks),
    availableDecisions: refreshDecisions(state),
  };
}

export function createSimulationFromScenario(scenario: Scenario): SimulationState {
  const team = scenario.team.map((m) => ({ ...m }));
  const tasks = SAMPLE_TASKS.map((t, index) => ({
    ...t,
    id: createId('task'),
    assigneeId: team[index % team.length]?.id ?? null,
    dayEnd: Math.min(t.dayEnd, scenario.deadlineDays),
    dayStart: Math.min(t.dayStart, Math.max(1, scenario.deadlineDays - 1)),
  }));
  const risks = SAMPLE_RISKS.map((r) => ({ ...r, id: createId('risk') }));
  const probability = baseProbability(scenario, tasks, risks);

  const events: SimulationEvent[] = [
    makeEvent(
      1,
      'Simulation initialized',
      `${scenario.name} is live. Goal: ${scenario.goal.title}.`,
      'system',
    ),
    makeEvent(
      1,
      'Baseline risks assessed',
      `${risks.length} active risks scored against current constraints.`,
      'risk',
    ),
    makeEvent(
      1,
      'Workstream loaded',
      `${tasks.length} tasks placed on the timeline across ${scenario.team.length} team members.`,
      'task',
    ),
  ];

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    goal: scenario.goal,
    day: 1,
    deadlineDays: scenario.deadlineDays,
    status: deriveStatus(probability, risks, tasks),
    successProbability: probability,
    resources: scenario.resources.map((r) => ({ ...r })),
    team,
    constraints: scenario.constraints.map((c) => ({ ...c })),
    tasks,
    risks,
    availableDecisions: buildInitialDecisions(tasks),
    events,
    riskTolerance: scenario.riskTolerance,
    lastDecisionId: null,
    lastConsequence: null,
  };
}

function applyReduceScope(state: SimulationState): SimulationState {
  const candidates = state.tasks.filter(
    (t) => t.priority !== 'high' && t.status !== 'completed',
  );
  const removed = candidates.slice(0, 2);
  const removedIds = new Set(removed.map((t) => t.id));
  const tasks = state.tasks.filter((t) => !removedIds.has(t.id));
  const risks = shiftRiskSeverities(state.risks, -1).map((r) =>
    r.title === 'Scope creep before launch'
      ? { ...r, severity: 'low' as RiskSeverity, probability: clamp(r.probability - 0.2, 0.05, 0.95) }
      : r,
  );

  const detail =
    removed.length > 0
      ? `Dropped ${removed.map((t) => t.title).join('; ')}. Risk pressure eased.`
      : 'No non-critical tasks remained to cut.';

  return {
    ...state,
    tasks,
    risks,
    events: [
      makeEvent(state.day, 'Scope reduced', detail, 'decision'),
      ...state.events,
    ],
    lastConsequence: detail,
  };
}

function applyAddTeamMember(state: SimulationState, decision: Decision): SimulationState {
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

  const budget = state.resources.map((r) =>
    r.type === 'budget'
      ? { ...r, remaining: Math.max(0, r.remaining - 4500) }
      : r,
  );

  const detail = `${member.name} joined as ${member.role}. Blocked work reassigned; budget reduced.`;

  return {
    ...state,
    team: [...state.team, member],
    tasks,
    resources: budget,
    risks: shiftRiskSeverities(state.risks, -1),
    events: [
      makeEvent(state.day, 'Team expanded', detail, 'team'),
      ...state.events,
    ],
    lastConsequence: detail,
  };
}

function applyMoveDeadline(state: SimulationState, decision: Decision): SimulationState {
  const newDeadline = Number(decision.payload?.newDeadlineDays ?? state.deadlineDays);
  const compressing = newDeadline < state.deadlineDays;

  let tasks = state.tasks;
  let risks = state.risks;
  let detail: string;

  if (compressing) {
    tasks = state.tasks.map((task) => {
      if (task.status === 'completed') return task;
      if (task.dayEnd > newDeadline || task.priority === 'medium') {
        return { ...task, status: 'needs_restructure' as const, dayEnd: Math.min(task.dayEnd, newDeadline) };
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
    detail = `Deadline moved from ${state.deadlineDays} to ${newDeadline} days. Risk elevated; several tasks need restructuring.`;
  } else {
    tasks = state.tasks.map((task) =>
      task.status === 'needs_restructure' ? { ...task, status: 'in_progress' as const } : task,
    );
    risks = shiftRiskSeverities(
      state.risks.filter((r) => r.title !== 'Compressed deadline pressure'),
      -1,
    );
    detail = `Deadline extended to ${newDeadline} days. Schedule pressure eased and restructuring cleared.`;
  }

  return {
    ...state,
    deadlineDays: newDeadline,
    tasks,
    risks,
    events: [
      makeEvent(state.day, 'Deadline adjusted', detail, 'decision'),
      ...state.events,
    ],
    lastConsequence: detail,
  };
}

function applyRemoveTask(state: SimulationState, decision: Decision): SimulationState {
  const taskId = String(decision.payload?.taskId ?? '');
  const target = state.tasks.find((t) => t.id === taskId) ?? state.tasks.find((t) => t.status !== 'completed');

  if (!target) {
    const detail = 'No removable task found.';
    return {
      ...state,
      events: [makeEvent(state.day, 'Task removal skipped', detail, 'task'), ...state.events],
      lastConsequence: detail,
    };
  }

  const tasks = state.tasks.filter((t) => t.id !== target.id);
  const detail = `Removed "${target.title}" from the plan. Capacity freed for critical path work.`;

  return {
    ...state,
    tasks,
    risks: shiftRiskSeverities(state.risks, -1),
    events: [
      makeEvent(state.day, 'Task removed', detail, 'task'),
      ...state.events,
    ],
    lastConsequence: detail,
  };
}

function applyIncreaseResources(state: SimulationState, decision: Decision): SimulationState {
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

  const detail = `Added ${budgetDelta.toLocaleString()} USD and ${bufferDays} buffer day(s). Blocked work resumed.`;

  return {
    ...state,
    resources,
    tasks,
    risks: shiftRiskSeverities(state.risks, -1),
    events: [
      makeEvent(state.day, 'Resources increased', detail, 'resource'),
      ...state.events,
    ],
    lastConsequence: detail,
  };
}

const handlers: Record<DecisionKind, (state: SimulationState, decision: Decision) => SimulationState> = {
  reduce_scope: (s) => applyReduceScope(s),
  add_team_member: applyAddTeamMember,
  move_deadline: applyMoveDeadline,
  remove_task: applyRemoveTask,
  increase_resources: applyIncreaseResources,
};

export function applyDecision(state: SimulationState, decisionId: string): SimulationState {
  const decision = state.availableDecisions.find((d) => d.id === decisionId);
  if (!decision || !decision.available) {
    return state;
  }

  const nextDay = Math.min(state.day + 1, state.deadlineDays);
  const mutated = handlers[decision.kind]({ ...state, day: nextDay }, decision);
  const withMeta: SimulationState = {
    ...mutated,
    lastDecisionId: decision.id,
    day: nextDay,
  };

  return recompute(withMeta);
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

  const events =
    completedNow.length > 0
      ? [
          makeEvent(
            day,
            'Tasks completed',
            completedNow.map((t) => t.title).join('; '),
            'task',
          ),
          ...state.events,
        ]
      : [
          makeEvent(day, 'Day advanced', `Simulation moved to day ${day}.`, 'system'),
          ...state.events,
        ];

  return recompute({
    ...state,
    day,
    tasks,
    events,
    lastConsequence: `Advanced to day ${day}.`,
  });
}
