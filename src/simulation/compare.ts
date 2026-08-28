import type {
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
  'openTasks',
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

/**
 * Temporary in-memory branch compare:
 * Scenario A = current plan (live state)
 * Scenario B = preview of applying decisionId
 */
export function compareScenarios(
  state: SimulationState,
  decisionId: string | null,
  labels?: { scenarioA?: string; scenarioB?: string },
): ScenarioCompareResult {
  const scenarioA = {
    label: labels?.scenarioA ?? 'Current plan',
    decisionTitle: null,
    metrics: snapshotMetrics(state.metrics),
  };

  if (!decisionId) {
    return {
      scenarioA,
      scenarioB: {
        label: labels?.scenarioB ?? 'No alternate selected',
        decisionTitle: null,
        metrics: snapshotMetrics(state.metrics),
      },
      deltas: [],
    };
  }

  const preview = previewDecision(state, decisionId);
  const decision = state.availableDecisions.find((d) => d.id === decisionId);

  const scenarioB = {
    label: labels?.scenarioB ?? decision?.title ?? 'Alternate plan',
    decisionTitle: decision?.title ?? preview?.decisionTitle ?? null,
    metrics: preview
      ? snapshotMetrics(preview.after)
      : snapshotMetrics(state.metrics),
  };

  const deltas: MetricChange[] = COMPARE_METRICS.map((metric) => ({
    metric,
    label: LABELS[metric],
    before: scenarioA.metrics[metric],
    after: scenarioB.metrics[metric],
    unit: unitFor(metric),
  })).filter((d) => d.before !== d.after);

  return { scenarioA, scenarioB, deltas };
}
