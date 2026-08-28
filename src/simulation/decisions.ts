import type {
  Consequence,
  Decision,
  DecisionCategory,
  DecisionKind,
  ImpactLevel,
  ImpactStep,
  Resource,
  Risk,
  RiskSeverity,
  SimulationEvent,
  SimulationState,
  Task,
  TeamMember,
} from '../types';
import { clamp, createId, rankToSeverity, severityRank } from '../utils/helpers';
import { conditions } from './conditions';
import {
  consequenceSummaries,
  consequencesToImpactChain,
  makeConsequence,
} from './consequences';
import { generateSimulationEvent } from './emergentEvents';

const KIND_CATEGORY: Record<DecisionKind, DecisionCategory> = {
  reduce_scope: 'scope',
  add_team_member: 'team',
  move_deadline: 'schedule',
  remove_task: 'tasks',
  increase_resources: 'resources',
};

function openTasksOf(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== 'completed');
}

function remainingDaysOf(day: number, deadlineDays: number): number {
  return Math.max(0, deadlineDays - day);
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
        { target: 'outcomeQuality', description: 'Ambition and outcome quality may fall', direction: 'decrease' },
      ];
    case 'add_team_member':
      return [
        { target: 'team', description: 'Add contractor capacity', direction: 'increase' },
        { target: 'teamCapacity', description: 'Raise available capacity', direction: 'increase' },
        { target: 'resources', description: 'Onboarding and budget draw', direction: 'decrease' },
      ];
    case 'move_deadline': {
      const extending = conditions.deadlineAlreadyTight(state);
      return extending
        ? [
            { target: 'deadline', description: 'Extend go-live window', direction: 'increase' },
            { target: 'timePressure', description: 'Ease schedule pressure', direction: 'decrease' },
            { target: 'successProbability', description: 'Improve delivery odds', direction: 'increase' },
          ]
        : [
            { target: 'deadline', description: 'Compress remaining schedule', direction: 'decrease' },
            { target: 'timePressure', description: 'Raise schedule pressure', direction: 'increase' },
            { target: 'risk', description: 'Elevate delivery risk', direction: 'increase' },
          ];
    }
    case 'remove_task':
      return [
        { target: 'tasks', description: 'Drop a selected work item', direction: 'decrease' },
        { target: 'timePressure', description: 'Free capacity', direction: 'decrease' },
        { target: 'outcomeQuality', description: 'May reduce outcome completeness', direction: 'decrease' },
      ];
    case 'increase_resources':
      return [
        { target: 'resources', description: 'Add budget and buffer', direction: 'increase' },
        { target: 'resourcePressure', description: 'Relieve resource pressure', direction: 'decrease' },
        { target: 'tasks', description: 'May unblock resource-bound work', direction: 'mixed' },
      ];
  }
}

function decisionRisks(kind: DecisionKind): string[] {
  switch (kind) {
    case 'reduce_scope':
      return ['Stakeholder pushback on cut features', 'Lower outcome ambition'];
    case 'add_team_member':
      return ['Onboarding drag', 'Budget overrun', 'Coordination overhead'];
    case 'move_deadline':
      return ['Quality shortcuts', 'Team burnout', 'Missed dependency windows', 'Continued resource burn'];
    case 'remove_task':
      return ['Hidden dependency breakage', 'Support gaps after launch', 'Lower outcome quality'];
    case 'increase_resources':
      return ['Diminishing returns', 'Approval delay for spend'];
  }
}

function estimatedImpactFor(kind: DecisionKind, state: SimulationState): ImpactLevel {
  if (kind === 'move_deadline') {
    if (state.metrics.remainingDays <= 3 || !conditions.deadlineAlreadyTight(state)) return 'high';
    return 'medium';
  }
  if (kind === 'reduce_scope') return 'medium';
  if (kind === 'add_team_member') return 'medium';
  if (kind === 'increase_resources') {
    return conditions.resourcesAlreadyHigh(state) ? 'low' : 'medium';
  }
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
    id: `dec_${kind}`,
    kind,
    category: KIND_CATEGORY[kind],
    effects: decisionEffects(kind, state),
    possibleRisks: decisionRisks(kind),
    estimatedImpact: estimatedImpactFor(kind, state),
    ...partial,
  };
}

/** Decisions appropriate to the current world — JSON-serializable catalog. */
export function getAvailableDecisions(state: SimulationState): Decision[] {
  const removable =
    state.tasks.find(
      (t) =>
        (t.priority !== 'high' && t.status !== 'completed') ||
        t.status === 'blocked' ||
        t.status === 'needs_restructure',
    ) ??
    state.tasks.find((t) => t.status === 'pending');

  const deadlineTight = conditions.deadlineAlreadyTight(state);
  const resourcesHigh = conditions.resourcesAlreadyHigh(state);

  return [
    buildDecision('reduce_scope', state, {
      title: 'Reduce scope',
      description: 'Cut non-critical deliverables to protect the launch window.',
      available: conditions.hasNonCriticalTasks(state),
    }),
    buildDecision('add_team_member', state, {
      title: 'Add team member',
      description: 'Bring in a contractor — raises capacity, adds onboarding load and spend.',
      available: !conditions.teamAtCapacity(state),
      payload: {
        name: 'Casey Brooks',
        role: 'Full-stack Contractor',
        capacity: 80,
        skills: ['React', 'APIs', 'QA'],
        onboardingLoad: true,
      },
    }),
    buildDecision('move_deadline', state, {
      title: deadlineTight ? 'Extend deadline by 3 days' : 'Shorten deadline to 4 days',
      description: deadlineTight
        ? 'Buy schedule back — pressure falls, but resources keep burning.'
        : 'Compress the timeline — stronger impact when the window is already short.',
      available: true,
      payload: {
        newDeadlineDays: deadlineTight ? state.deadlineDays + 3 : 4,
        direction: deadlineTight ? 'extend' : 'shorten',
      },
    }),
    buildDecision('remove_task', state, {
      title: removable ? `Remove task: ${removable.title}` : 'Remove a pending task',
      description: removable
        ? `Drop "${removable.title}" to cut workload — may reduce outcome quality.`
        : 'No removable tasks remain.',
      available: Boolean(removable) && conditions.hasRemovableTasks(state),
      payload: {
        taskId: removable?.id,
        reason: removable?.status === 'blocked'
          ? 'Unblock capacity by dropping a blocked item'
          : 'Reduce workload on the critical path',
      },
    }),
    buildDecision('increase_resources', state, {
      title: resourcesHigh ? 'Increase resources (diminishing returns)' : 'Increase resources',
      description: resourcesHigh
        ? 'Pools are already healthy — further spend adds little unless work is blocked.'
        : 'Allocate additional budget and schedule buffer; may unblock resource-bound tasks.',
      available: !resourcesHigh || conditions.hasBlockedTasks(state),
      payload: {
        budgetDelta: resourcesHigh ? 3000 : 8000,
        bufferDays: resourcesHigh ? 1 : 2,
      },
    }),
  ];
}

export interface MutationOutcome {
  state: SimulationState;
  consequences: Consequence[];
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

  const qualityHit = removed.length * 8;
  const outcomeQuality = clamp(state.outcomeQuality - qualityHit, 20, 100);

  const consequences: Consequence[] = [];
  if (removed.length > 0) {
    consequences.push(
      makeConsequence({
        type: 'direct',
        title: 'Tasks removed',
        description: `Dropped ${removed.length} non-critical task(s): ${removed.map((t) => t.title).join('; ')}.`,
        metric: 'openTasks',
        value: -removed.length,
        severity: 'medium',
      }),
    );
  } else {
    consequences.push(
      makeConsequence({
        type: 'direct',
        title: 'No tasks cut',
        description: 'No non-critical tasks remained to remove.',
        severity: 'low',
      }),
    );
  }

  consequences.push(
    makeConsequence({
      type: 'secondary',
      title: 'Time pressure eases',
      description: 'Less work competing for the same launch window.',
      metric: 'timePressure',
      severity: 'low',
    }),
    makeConsequence({
      type: 'secondary',
      title: 'Resource pressure eases',
      description: 'Fewer deliverables draw on the same pools.',
      metric: 'resourcePressure',
      severity: 'low',
    }),
  );

  if (removed.length > 0) {
    consequences.push(
      makeConsequence({
        type: 'emergent',
        title: 'Lower project ambition',
        description: 'Cutting scope reduces what the launch can claim as complete.',
        metric: 'outcomeQuality',
        value: -qualityHit,
        severity: 'medium',
      }),
      makeConsequence({
        type: 'emergent',
        title: 'Outcome quality at risk',
        description: 'Delivery odds may rise while the shipped result is thinner.',
        metric: 'outcomeQuality',
        severity: 'medium',
      }),
    );
  }

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Scope reduced',
      description: consequences[0].description,
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
        seq: 1,
      }),
    );
  }

  return {
    state: { ...state, tasks, risks, outcomeQuality },
    consequences,
    events,
    impactChain: consequencesToImpactChain(
      decision.title,
      decision.description,
      consequences,
      'Delivery odds typically rise; ambition falls',
    ),
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

  // Temporary onboarding drag: new member starts at reduced effective capacity.
  const onboardedMember: TeamMember = {
    ...member,
    capacity: Math.max(35, Math.round(member.capacity * 0.55)),
  };

  const resources = state.resources.map((r) =>
    r.type === 'budget' ? { ...r, remaining: Math.max(0, r.remaining - 4500) } : r,
  );

  let tasks = state.tasks;
  const risks = shiftRiskSeverities(state.risks, -1);

  const consequences: Consequence[] = [
    makeConsequence({
      type: 'direct',
      title: 'Team capacity added',
      description: `${member.name} joined as ${member.role} (onboarding at reduced capacity).`,
      metric: 'teamCapacity',
      value: 1,
      severity: 'medium',
    }),
    makeConsequence({
      type: 'secondary',
      title: 'Onboarding workload',
      description: 'New hire absorbs coordination time; effective capacity ramps over days.',
      metric: 'teamCapacity',
      severity: 'medium',
    }),
    makeConsequence({
      type: 'secondary',
      title: 'Resource usage up',
      description: 'Contractor cost drawn from project budget (−4,500).',
      metric: 'resourcePressure',
      value: 4500,
      severity: 'medium',
    }),
  ];

  if (conditions.shortDeadline(state)) {
    consequences.push(
      makeConsequence({
        type: 'emergent',
        title: 'Temporary time pressure',
        description: 'With a short deadline, onboarding overhead can raise schedule pressure before capacity helps.',
        metric: 'timePressure',
        severity: 'high',
      }),
    );
  } else {
    // Comfortable schedule: unblock blocked work immediately
    tasks = state.tasks.map((task) => {
      if (task.status === 'blocked' || task.status === 'needs_restructure') {
        return { ...task, status: 'in_progress' as const, assigneeId: member.id };
      }
      return task;
    });
    consequences.push(
      makeConsequence({
        type: 'emergent',
        title: 'Blocked work reassigned',
        description: 'With schedule room, blocked / restructure items move to the new hire.',
        metric: 'openTasks',
        severity: 'low',
      }),
    );
  }

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Team expanded',
      description: consequences[0].description,
      impact: `Team ${state.team.length} → ${state.team.length + 1}`,
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
    generateSimulationEvent({
      day: state.day,
      eventType: 'team_change',
      title: 'Capacity injected',
      description: `${member.name} joining with onboarding drag.`,
      impact: 'Team size +1 · onboarding load',
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
      seq: 1,
    }),
    generateSimulationEvent({
      day: state.day,
      eventType: 'resource_change',
      title: 'Budget consumed',
      description: 'Contractor cost drawn from project budget.',
      impact: '−4,500 USD remaining budget',
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
      seq: 2,
    }),
  ];

  return {
    state: {
      ...state,
      team: [...state.team, onboardedMember],
      tasks,
      resources,
      risks,
    },
    consequences,
    events,
    impactChain: consequencesToImpactChain(
      decision.title,
      decision.description,
      consequences,
      'Net capacity rises after onboarding settles',
    ),
  };
}

function applyMoveDeadline(state: SimulationState, decision: Decision): MutationOutcome {
  const newDeadline = Number(decision.payload?.newDeadlineDays ?? state.deadlineDays);
  const extending = newDeadline > state.deadlineDays;

  let tasks = state.tasks;
  let risks = state.risks;
  const consequences: Consequence[] = [];
  const events: SimulationEvent[] = [];

  if (!extending) {
    tasks = state.tasks.map((task) => {
      if (task.status === 'completed') return task;
      if (task.dayEnd > newDeadline || task.priority === 'medium') {
        return {
          ...task,
          status: 'needs_restructure' as const,
          dayEnd: Math.min(task.dayEnd, newDeadline),
          priority:
            task.priority === 'low'
              ? 'medium'
              : task.priority === 'medium'
                ? 'high'
                : task.priority,
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
      makeConsequence({
        type: 'direct',
        title: 'Deadline shortened',
        description: `Deadline moved from ${state.deadlineDays} to ${newDeadline} days.`,
        metric: 'remainingDays',
        value: remainingDaysOf(state.day, newDeadline) - state.metrics.remainingDays,
        severity: 'high',
      }),
      makeConsequence({
        type: 'secondary',
        title: 'Time pressure rises',
        description: 'Same workload compressed into fewer calendar days.',
        metric: 'timePressure',
        severity: 'high',
      }),
      makeConsequence({
        type: 'secondary',
        title: 'Risk increases',
        description: 'Delivery and defect exposure climb under compression.',
        metric: 'risk',
        severity: 'high',
      }),
      makeConsequence({
        type: 'emergent',
        title: 'Tasks turn critical',
        description: `${criticalized} task(s) marked needs restructure to fit the window.`,
        metric: 'openTasks',
        severity: 'high',
      }),
    );

    events.push(
      generateSimulationEvent({
        day: state.day,
        eventType: 'decision_applied',
        title: 'Deadline compressed',
        description: consequences[0].description,
        impact: `Days remaining → ${remainingDaysOf(state.day, newDeadline)}`,
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
      generateSimulationEvent({
        day: state.day,
        eventType: 'risk_change',
        title: 'Schedule risk spiked',
        description: 'Compressed deadline pressure introduced as a critical risk.',
        impact: 'Risk severity increased',
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
        seq: 1,
      }),
    );
  } else {
    // Extending: pressure down, success up, but resources continue consuming
    tasks = state.tasks.map((task) =>
      task.status === 'needs_restructure' ? { ...task, status: 'in_progress' as const } : task,
    );
    risks = shiftRiskSeverities(
      state.risks.filter((r) => r.title !== 'Compressed deadline pressure'),
      -1,
    );

    const resources: Resource[] = state.resources.map((r) => {
      if (r.type === 'budget' || r.type === 'time') {
        const burn = Math.max(1, Math.round(r.amount * 0.04));
        return { ...r, remaining: Math.max(0, r.remaining - burn) };
      }
      return r;
    });

    consequences.push(
      makeConsequence({
        type: 'direct',
        title: 'Deadline extended',
        description: `Deadline extended to ${newDeadline} days.`,
        metric: 'remainingDays',
        value: remainingDaysOf(state.day, newDeadline) - state.metrics.remainingDays,
        severity: 'medium',
      }),
      makeConsequence({
        type: 'secondary',
        title: 'Time pressure decreases',
        description: 'Workload spreads across a longer calendar.',
        metric: 'timePressure',
        severity: 'low',
      }),
      makeConsequence({
        type: 'secondary',
        title: 'Success probability rises',
        description: 'More buffer improves odds of landing the goal.',
        metric: 'successProbability',
        severity: 'low',
      }),
      makeConsequence({
        type: 'emergent',
        title: 'Resource consumption continues',
        description: 'Extending the calendar keeps burn running on budget and time pools.',
        metric: 'resourcePressure',
        severity: 'medium',
      }),
    );

    events.push(
      generateSimulationEvent({
        day: state.day,
        eventType: 'decision_applied',
        title: 'Deadline extended',
        description: consequences[0].description,
        impact: `Deadline ${state.deadlineDays} → ${newDeadline} days`,
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
      }),
      generateSimulationEvent({
        day: state.day,
        eventType: 'resource_change',
        title: 'Ongoing resource burn',
        description: 'Extended runway continues consuming budget and time buffers.',
        impact: 'Resource remaining reduced slightly',
        relatedDecisionId: decision.id,
        relatedDecisionTitle: decision.title,
        seq: 1,
      }),
    );

    return {
      state: { ...state, deadlineDays: newDeadline, tasks, risks, resources },
      consequences,
      events,
      impactChain: consequencesToImpactChain(
        decision.title,
        decision.description,
        consequences,
        'Schedule eases; burn continues',
      ),
    };
  }

  return {
    state: { ...state, deadlineDays: newDeadline, tasks, risks },
    consequences,
    events,
    impactChain: consequencesToImpactChain(
      decision.title,
      decision.description,
      consequences,
      'Compression raises risk unless scope changes',
    ),
  };
}

function applyRemoveTask(state: SimulationState, decision: Decision): MutationOutcome {
  const taskId = String(decision.payload?.taskId ?? '');
  const reason = String(decision.payload?.reason ?? 'Reduce workload');
  const target =
    state.tasks.find((t) => t.id === taskId) ??
    state.tasks.find((t) => t.status !== 'completed' && t.priority !== 'high') ??
    state.tasks.find((t) => t.status !== 'completed');

  if (!target) {
    const consequences = [
      makeConsequence({
        type: 'direct',
        title: 'No task removed',
        description: 'No removable task found.',
        severity: 'low',
      }),
    ];
    return {
      state,
      consequences,
      events: [
        generateSimulationEvent({
          day: state.day,
          eventType: 'task_change',
          title: 'Task removal skipped',
          description: consequences[0].description,
          impact: 'No change',
          relatedDecisionId: decision.id,
          relatedDecisionTitle: decision.title,
        }),
      ],
      impactChain: consequencesToImpactChain(decision.title, decision.description, consequences),
    };
  }

  const tasks = state.tasks.filter((t) => t.id !== target.id);
  const qualityHit = target.priority === 'high' ? 12 : target.priority === 'medium' ? 8 : 5;
  const outcomeQuality = clamp(state.outcomeQuality - qualityHit, 20, 100);
  const risks = shiftRiskSeverities(state.risks, -1);

  const consequences: Consequence[] = [
    makeConsequence({
      type: 'direct',
      title: 'Workload lowered',
      description: `Removed "${target.title}". Reason: ${reason}.`,
      metric: 'openTasks',
      value: -1,
      severity: 'medium',
    }),
    makeConsequence({
      type: 'secondary',
      title: 'Time pressure eases',
      description: 'One less item competing for calendar capacity.',
      metric: 'timePressure',
      severity: 'low',
    }),
    makeConsequence({
      type: 'emergent',
      title: 'Outcome quality may fall',
      description: 'Dropping work can leave gaps in the shipped result.',
      metric: 'outcomeQuality',
      value: -qualityHit,
      severity: target.priority === 'high' ? 'high' : 'medium',
    }),
  ];

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Task removed',
      description: consequences[0].description,
      impact: `Open tasks → ${openTasksOf(tasks).length}`,
      relatedDecisionId: decision.id,
      relatedDecisionTitle: decision.title,
    }),
  ];

  return {
    state: { ...state, tasks, risks, outcomeQuality },
    consequences,
    events,
    impactChain: consequencesToImpactChain(
      decision.title,
      decision.description,
      consequences,
      'Workload down; completeness trade-off',
    ),
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

  const significantIncrease = budgetDelta >= 6000 || bufferDays >= 2;
  let tasks = state.tasks;
  const blocked = state.tasks.filter((t) => t.status === 'blocked');

  const consequences: Consequence[] = [
    makeConsequence({
      type: 'direct',
      title: 'Resources increased',
      description: `Added ${budgetDelta.toLocaleString()} USD and ${bufferDays} buffer day(s).`,
      metric: 'resourcePressure',
      value: budgetDelta,
      severity: 'medium',
    }),
    makeConsequence({
      type: 'secondary',
      title: 'Resource pressure falls',
      description: 'Spend and time headroom expand.',
      metric: 'resourcePressure',
      severity: 'low',
    }),
  ];

  if (significantIncrease && blocked.length > 0) {
    tasks = state.tasks.map((t) =>
      t.status === 'blocked' ? { ...t, status: 'in_progress' as const } : t,
    );
    consequences.push(
      makeConsequence({
        type: 'emergent',
        title: 'Blocked tasks become available',
        description: `${blocked.length} blocked task(s) resumed now that resource constraints eased.`,
        metric: 'openTasks',
        severity: 'medium',
      }),
    );
  } else if (conditions.hasBlockedTasks(state) && !significantIncrease) {
    consequences.push(
      makeConsequence({
        type: 'emergent',
        title: 'Limited unblock effect',
        description: 'Increase was modest — blocked work stays blocked until a larger injection.',
        severity: 'low',
      }),
    );
  }

  const risks = shiftRiskSeverities(state.risks, -1);

  const events = [
    generateSimulationEvent({
      day: state.day,
      eventType: 'decision_applied',
      title: 'Resources increased',
      description: consequences[0].description,
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
      seq: 1,
    }),
  ];

  return {
    state: { ...state, resources, tasks, risks },
    consequences,
    events,
    impactChain: consequencesToImpactChain(
      decision.title,
      decision.description,
      consequences,
      'Constraints loosen; blocked work may resume',
    ),
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

export function applyDecisionMutation(
  state: SimulationState,
  decision: Decision,
): MutationOutcome {
  return handlers[decision.kind](state, decision);
}

export { consequenceSummaries, openTasksOf, remainingDaysOf, shiftRiskSeverities };
