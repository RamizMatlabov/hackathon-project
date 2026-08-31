import type {
  CompareRecommendationSignal,
  MetricChange,
  MetricKey,
  ScenarioCompareResult,
  SimulationMetrics,
  SimulationState,
} from '../types';
import { previewDecision } from './engine';

const COMPARE_METRICS: MetricKey[] = [
  'successProbability',
  'risk',
  'timePressure',
  'resourcePressure',
  'teamCapacity',
  'outcomeQuality',
];

const LABELS: Record<MetricKey, string> = {
  successProbability: 'Success probability',
  risk: 'Risk',
  timePressure: 'Time pressure',
  resourcePressure: 'Resource pressure',
  teamCapacity: 'Team capacity',
  openTasks: 'Tasks remaining',
  remainingDays: 'Days remaining',
  teamSize: 'Team size',
  outcomeQuality: 'Outcome quality',
};

function unitFor(key: MetricKey): MetricChange['unit'] {
  if (key === 'openTasks' || key === 'teamSize') return 'count';
  if (key === 'remainingDays') return 'days';
  return '%';
}

function snapshotMetrics(metrics: SimulationMetrics): SimulationMetrics {
  return { ...metrics };
}

function buildDeltas(
  before: SimulationMetrics,
  after: SimulationMetrics,
): MetricChange[] {
  return COMPARE_METRICS.map((metric) => ({
    metric,
    label: LABELS[metric],
    before: before[metric],
    after: after[metric],
    unit: unitFor(metric),
  }));
}

function deriveRecommendation(
  before: SimulationMetrics,
  after: SimulationMetrics,
): { signal: CompareRecommendationSignal; rationale: string } {
  const successDelta = after.successProbability - before.successProbability;
  const timeDelta = after.timePressure - before.timePressure;
  const resourceDelta = after.resourcePressure - before.resourcePressure;
  const riskDelta = after.risk - before.risk;

  const successImproved = successDelta >= 3;
  const speedImproved = timeDelta <= -3;
  const resourcesImproved = resourceDelta <= -3;
  const riskWorsened = riskDelta >= 5;

  if (successImproved && speedImproved && !riskWorsened) {
    return {
      signal: 'better_for_success',
      rationale: `Success probability +${successDelta}% with lower time pressure (${timeDelta}%).`,
    };
  }
  if (speedImproved && timeDelta <= -5 && successDelta >= -2) {
    return {
      signal: 'better_for_speed',
      rationale: `Time pressure drops ${Math.abs(timeDelta)}% with manageable success impact (${successDelta >= 0 ? '+' : ''}${successDelta}%).`,
    };
  }
  if (resourcesImproved && resourceDelta <= -5) {
    return {
      signal: 'better_for_resources',
      rationale: `Resource pressure eases ${Math.abs(resourceDelta)}% (${resourceDelta}%).`,
    };
  }
  if (
    (successImproved && riskWorsened) ||
    (speedImproved && successDelta < -3) ||
    (resourcesImproved && successDelta < -3)
  ) {
    return {
      signal: 'tradeoff',
      rationale: `Mixed tradeoff: success ${successDelta >= 0 ? '+' : ''}${successDelta}%, risk ${riskDelta >= 0 ? '+' : ''}${riskDelta}%, time pressure ${timeDelta >= 0 ? '+' : ''}${timeDelta}%.`,
    };
  }
  if (Math.abs(successDelta) < 2 && Math.abs(timeDelta) < 2 && Math.abs(resourceDelta) < 2) {
    return {
      signal: 'neutral',
      rationale: 'Metrics are largely unchanged between scenarios.',
    };
  }
  if (successDelta > 0) {
    return {
      signal: 'better_for_success',
      rationale: `Success probability improves by ${successDelta}%.`,
    };
  }
  return {
    signal: 'tradeoff',
    rationale: `Scenario B shifts success ${successDelta}%, risk ${riskDelta}%, time pressure ${timeDelta}%.`,
  };
}

function metricsFromDecision(
  state: SimulationState,
  decisionId: string,
): { metrics: SimulationMetrics; title: string | null } {
  const preview = previewDecision(state, decisionId);
  const decision = state.availableDecisions.find((d) => d.id === decisionId);
  return {
    metrics: preview
      ? snapshotMetrics(preview.after)
      : snapshotMetrics(state.metrics),
    title: decision?.title ?? preview?.decisionTitle ?? null,
  };
}

/**
 * Temporary in-memory branch compare:
 * Scenario A = current plan OR first decision branch
 * Scenario B = preview of decision_id OR versus_decision_id
 */
export function compareScenarios(
  state: SimulationState,
  decisionId: string | null,
  options?: {
    versusDecisionId?: string | null;
    labels?: { scenarioA?: string; scenarioB?: string };
  },
): ScenarioCompareResult {
  const versusId = options?.versusDecisionId ?? null;

  if (versusId && decisionId) {
    const branchA = metricsFromDecision(state, decisionId);
    const branchB = metricsFromDecision(state, versusId);
    const scenarioA = {
      label: options?.labels?.scenarioA ?? branchA.title ?? 'Option A',
      decisionTitle: branchA.title,
      decisionId,
      metrics: branchA.metrics,
    };
    const scenarioB = {
      label: options?.labels?.scenarioB ?? branchB.title ?? 'Option B',
      decisionTitle: branchB.title,
      decisionId: versusId,
      metrics: branchB.metrics,
    };
    const recommendation = deriveRecommendation(scenarioA.metrics, scenarioB.metrics);
    return {
      scenarioA,
      scenarioB,
      deltas: buildDeltas(scenarioA.metrics, scenarioB.metrics).filter(
        (d) => d.before !== d.after,
      ),
      recommendation: recommendation.signal,
      recommendationRationale: recommendation.rationale,
    };
  }

  const scenarioA = {
    label: options?.labels?.scenarioA ?? 'Current plan',
    decisionTitle: null,
    decisionId: null,
    metrics: snapshotMetrics(state.metrics),
  };

  if (!decisionId) {
    return {
      scenarioA,
      scenarioB: {
        label: options?.labels?.scenarioB ?? 'No alternate selected',
        decisionTitle: null,
        decisionId: null,
        metrics: snapshotMetrics(state.metrics),
      },
      deltas: [],
      recommendation: 'neutral',
      recommendationRationale: 'Provide decision_id to compare an alternate branch.',
    };
  }

  const branch = metricsFromDecision(state, decisionId);
  const scenarioB = {
    label: options?.labels?.scenarioB ?? branch.title ?? 'Alternate plan',
    decisionTitle: branch.title,
    decisionId,
    metrics: branch.metrics,
  };

  const recommendation = deriveRecommendation(scenarioA.metrics, scenarioB.metrics);

  return {
    scenarioA,
    scenarioB,
    deltas: buildDeltas(scenarioA.metrics, scenarioB.metrics).filter(
      (d) => d.before !== d.after,
    ),
    recommendation: recommendation.signal,
    recommendationRationale: recommendation.rationale,
  };
}
