import type { ImpactLevel, MetricChange } from '../types';
import type { AgentRecommendation, WebMCPDebugEntry } from './types';

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isImpactLevel(value: unknown): value is ImpactLevel {
  return value === 'low' || value === 'medium' || value === 'high';
}

function parseMetricChanges(value: unknown): MetricChange[] {
  if (!Array.isArray(value)) return [];

  const changes: MetricChange[] = [];
  for (const item of value) {
    const row = asObject(item);
    if (!row) continue;
    if (typeof row.metric !== 'string' || typeof row.label !== 'string') continue;
    if (typeof row.before !== 'number' || typeof row.after !== 'number') continue;
    changes.push({
      metric: row.metric as MetricChange['metric'],
      label: row.label,
      before: row.before,
      after: row.after,
      unit: row.unit === '%' || row.unit === 'count' || row.unit === 'days' ? row.unit : undefined,
    });
  }
  return changes;
}

/** Build agent recommendation state from a successful preview_decision tool result. */
export function parseAgentPreviewFromEntry(entry: WebMCPDebugEntry): AgentRecommendation | null {
  if (entry.tool !== 'preview_decision' || !entry.result.success) return null;

  const data = asObject(entry.result.data);
  if (!data) return null;

  const previewId = data.previewId;
  const simulationVersion = data.simulationVersion;
  const decisionId = data.decisionId;
  const decisionTitle = data.decisionTitle;
  const estimatedImpact = data.estimatedImpact;

  if (typeof previewId !== 'string' || previewId.length === 0) return null;
  if (typeof simulationVersion !== 'number' || !Number.isFinite(simulationVersion)) return null;
  if (typeof decisionId !== 'string' || decisionId.length === 0) return null;
  if (typeof decisionTitle !== 'string' || decisionTitle.length === 0) return null;
  if (!isImpactLevel(estimatedImpact)) return null;

  return {
    previewId,
    simulationVersion,
    decisionId,
    decisionTitle,
    changes: parseMetricChanges(data.changes),
    estimatedImpact,
    status: 'pending',
  };
}

/** Update agent recommendation after agent tool calls (preview / apply). */
export function deriveAgentRecommendationUpdate(
  entry: WebMCPDebugEntry,
  current: AgentRecommendation | null,
): AgentRecommendation | null | undefined {
  const preview = parseAgentPreviewFromEntry(entry);
  if (preview) return preview;

  if (entry.tool !== 'apply_decision' || !entry.result.success) return undefined;

  const args = asObject(entry.args) ?? {};
  const decisionId = args.decision_id;
  if (typeof decisionId !== 'string' || decisionId.length === 0) return undefined;

  if (current?.decisionId === decisionId && current.status === 'pending') {
    return { ...current, status: 'applied' };
  }

  return current?.status === 'pending' ? null : undefined;
}
