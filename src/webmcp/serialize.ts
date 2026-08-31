import type {
  Consequence,
  Decision,
  DecisionResult,
  MetricChange,
  ScenarioCompareResult,
  SimulationState,
} from '../types';

function groupConsequences(consequences: Consequence[]) {
  return {
    direct: consequences.filter((c) => c.type === 'direct'),
    secondary: consequences.filter((c) => c.type === 'secondary'),
    emergent: consequences.filter((c) => c.type === 'emergent'),
  };
}

function summarizeChanges(changes: MetricChange[]) {
  return changes
    .filter((c) => c.before !== c.after)
    .map((c) => {
      const delta = c.after - c.before;
      const sign = delta > 0 ? '+' : '';
      const suffix = c.unit === '%' ? '%' : c.unit === 'days' ? ' days' : '';
      return `${c.label}: ${c.before}${suffix} → ${c.after}${suffix} (${sign}${delta}${suffix})`;
    });
}

/** JSON-safe projection of simulation state for agent consumption. */
export function serializeSimulationState(state: SimulationState) {
  return {
    scenario: {
      id: state.scenarioId,
      name: state.scenarioName,
      goal: state.goal.title,
      goalDescription: state.goal.description,
      successCriteria: state.goal.successCriteria,
    },
    simulationVersion: state.simulationVersion,
    day: state.day,
    deadlineDays: state.deadlineDays,
    remainingDays: state.remainingDays,
    status: state.status,
    successProbability: state.successProbability,
    outcomeQuality: state.outcomeQuality,
    riskTolerance: state.riskTolerance,
    metrics: {
      successProbability: state.metrics.successProbability,
      risk: state.metrics.risk,
      timePressure: state.metrics.timePressure,
      resourcePressure: state.metrics.resourcePressure,
      teamCapacity: state.metrics.teamCapacity,
      outcomeQuality: state.metrics.outcomeQuality,
      openTasks: state.metrics.openTasks,
      teamSize: state.metrics.teamSize,
    },
    tasks: state.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assigneeId: t.assigneeId,
      estimatedDays: t.estimatedDays,
      dayStart: t.dayStart,
      dayEnd: t.dayEnd,
    })),
    resources: state.resources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      remaining: r.remaining,
      amount: r.amount,
      unit: r.unit,
    })),
    team: state.team.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      capacity: m.capacity,
      skills: m.skills,
    })),
    risks: state.risks.map((r) => ({
      id: r.id,
      title: r.title,
      severity: r.severity,
      probability: r.probability,
      mitigation: r.mitigation,
    })),
    constraints: state.constraints.map((c) => ({
      id: c.id,
      label: c.label,
      hard: c.hard,
    })),
    availableDecisions: state.availableDecisions.map(serializeDecisionSummary),
    recentChanges: state.recentChanges,
    narrative: state.narrative,
    lastConsequence: state.lastConsequence,
    recentEvents: state.events.slice(0, 12).map((event) => ({
      id: event.id,
      day: event.day,
      eventType: event.eventType,
      actorSource: event.actorSource,
      title: event.title,
      description: event.description,
      impact: event.impact,
      relatedDecisionTitle: event.relatedDecisionTitle,
    })),
  };
}

export function serializeDecisionSummary(decision: Decision) {
  return {
    id: decision.id,
    kind: decision.kind,
    title: decision.title,
    description: decision.description,
    category: decision.category,
    available: decision.available,
    estimatedImpact: decision.estimatedImpact,
    possibleRisks: decision.possibleRisks,
    effects: decision.effects,
  };
}

export function serializeDecisionResult(
  result: DecisionResult,
  context?: { previewId: string; simulationVersion: number },
) {
  const grouped = groupConsequences(result.consequences);

  return {
    previewId: context?.previewId,
    simulationVersion: context?.simulationVersion,
    decisionId: result.decisionId,
    decisionTitle: result.decisionTitle,
    decisionDescription: result.decisionDescription,
    category: result.category,
    readOnly: true,
    before: result.before,
    after: result.after,
    changes: result.changes,
    consequences: result.consequences,
    consequenceSummaries: result.consequenceSummaries,
    impactChain: result.impactChain,
    estimatedImpact: result.estimatedImpact,
    possibleRisks: result.possibleRisks,
    explanation: {
      whatChanged: summarizeChanges(result.changes),
      whyItChanged: result.impactChain
        .filter((s) => s.kind !== 'outcome')
        .map((s) => (s.detail ? `${s.label}: ${s.detail}` : s.label)),
      directConsequences: grouped.direct.map((c) => ({
        title: c.title,
        description: c.description,
        severity: c.severity,
      })),
      secondaryConsequences: grouped.secondary.map((c) => ({
        title: c.title,
        description: c.description,
        severity: c.severity,
      })),
      emergentConsequences: grouped.emergent.map((c) => ({
        title: c.title,
        description: c.description,
        severity: c.severity,
      })),
      metricDeltas: result.changes.filter((c) => c.before !== c.after),
      newEvents: result.events.slice(0, 8).map((e) => ({
        title: e.title,
        description: e.description,
        impact: e.impact,
        eventType: e.eventType,
      })),
    },
    nextStep:
      'Explain consequences to the user and wait for confirmation before calling apply_decision.',
  };
}

export function serializeCompareResult(result: ScenarioCompareResult) {
  return {
    scenarioA: {
      label: result.scenarioA.label,
      decisionTitle: result.scenarioA.decisionTitle,
      decisionId: result.scenarioA.decisionId,
      metrics: {
        successProbability: result.scenarioA.metrics.successProbability,
        risk: result.scenarioA.metrics.risk,
        timePressure: result.scenarioA.metrics.timePressure,
        resourcePressure: result.scenarioA.metrics.resourcePressure,
        teamCapacity: result.scenarioA.metrics.teamCapacity,
        outcomeQuality: result.scenarioA.metrics.outcomeQuality,
      },
    },
    scenarioB: {
      label: result.scenarioB.label,
      decisionTitle: result.scenarioB.decisionTitle,
      decisionId: result.scenarioB.decisionId,
      metrics: {
        successProbability: result.scenarioB.metrics.successProbability,
        risk: result.scenarioB.metrics.risk,
        timePressure: result.scenarioB.metrics.timePressure,
        resourcePressure: result.scenarioB.metrics.resourcePressure,
        teamCapacity: result.scenarioB.metrics.teamCapacity,
        outcomeQuality: result.scenarioB.metrics.outcomeQuality,
      },
    },
    deltas: result.deltas,
    recommendation: result.recommendation,
    recommendationRationale: result.recommendationRationale,
    readOnly: true,
  };
}

export function serializeSimulatePreview(state: SimulationState) {
  return {
    readOnly: true,
    simulationVersion: state.simulationVersion,
    metrics: {
      successProbability: state.metrics.successProbability,
      risk: state.metrics.risk,
      timePressure: state.metrics.timePressure,
      resourcePressure: state.metrics.resourcePressure,
      teamCapacity: state.metrics.teamCapacity,
      outcomeQuality: state.metrics.outcomeQuality,
    },
    status: state.status,
    successProbability: state.successProbability,
    remainingDays: state.remainingDays,
    narrative: state.narrative,
    recentChanges: state.recentChanges,
    explanation: {
      whatChanged: state.recentChanges.map(
        (c) => `${c.label} ${c.direction}${c.detail ? `: ${c.detail}` : ''}`,
      ),
      narrative: state.narrative,
    },
  };
}
