import type {
  Decision,
  DecisionResult,
  ScenarioCompareResult,
  SimulationState,
} from '../types';

/** JSON-safe projection of simulation state for agent consumption. */
export function serializeSimulationState(state: SimulationState) {
  return {
    scenarioId: state.scenarioId,
    scenarioName: state.scenarioName,
    goal: state.goal,
    day: state.day,
    deadlineDays: state.deadlineDays,
    remainingDays: state.remainingDays,
    status: state.status,
    successProbability: state.successProbability,
    metrics: state.metrics,
    resources: state.resources,
    team: state.team,
    constraints: state.constraints,
    tasks: state.tasks,
    risks: state.risks,
    availableDecisions: state.availableDecisions.map(serializeDecisionSummary),
    decisionsHistory: state.decisionsHistory,
    recentChanges: state.recentChanges,
    narrative: state.narrative,
    outcomeQuality: state.outcomeQuality,
    riskTolerance: state.riskTolerance,
    lastDecisionId: state.lastDecisionId,
    lastConsequence: state.lastConsequence,
    recentEvents: state.events.slice(0, 12).map((event) => ({
      id: event.id,
      day: event.day,
      eventType: event.eventType,
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

export function serializeDecisionResult(result: DecisionResult) {
  return {
    decisionId: result.decisionId,
    decisionTitle: result.decisionTitle,
    decisionDescription: result.decisionDescription,
    category: result.category,
    before: result.before,
    after: result.after,
    changes: result.changes,
    consequences: result.consequences,
    consequenceSummaries: result.consequenceSummaries,
    impactChain: result.impactChain,
    estimatedImpact: result.estimatedImpact,
    possibleRisks: result.possibleRisks,
  };
}

export function serializeCompareResult(result: ScenarioCompareResult) {
  return {
    scenarioA: result.scenarioA,
    scenarioB: result.scenarioB,
    deltas: result.deltas,
  };
}

export function serializeSimulatePreview(state: SimulationState) {
  return {
    metrics: state.metrics,
    status: state.status,
    successProbability: state.successProbability,
    remainingDays: state.remainingDays,
    narrative: state.narrative,
    recentChanges: state.recentChanges,
  };
}
