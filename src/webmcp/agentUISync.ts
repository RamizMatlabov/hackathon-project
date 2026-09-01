import type { AgentUISyncIntent, WebMCPDebugEntry } from './types';

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Map a successful WebMCP tool call to workspace UI intent (analyze/act sync only). */
export function deriveAgentUISyncIntent(
  entry: WebMCPDebugEntry,
): Omit<AgentUISyncIntent, 'seq'> | null {
  if (!entry.result.success) return null;

  const args = asObject(entry.args) ?? {};

  switch (entry.tool) {
    case 'preview_decision': {
      const data = asObject(entry.result.data);
      const decisionId = data?.decisionId;
      if (typeof decisionId !== 'string' || decisionId.length === 0) return null;
      return { selectedDecisionId: decisionId };
    }
    case 'compare_scenario_branch': {
      const decisionId = args.decision_id;
      if (typeof decisionId !== 'string' || decisionId.length === 0) return null;
      const versusRaw = args.versus_decision_id;
      const branchVersusDecisionId =
        typeof versusRaw === 'string' && versusRaw.length > 0 ? versusRaw : null;
      return {
        branchDecisionId: decisionId,
        branchVersusDecisionId,
      };
    }
    case 'apply_decision':
      return {
        selectedDecisionId: null,
        branchDecisionId: null,
        branchVersusDecisionId: null,
        mutationHighlight: 'apply_decision',
      };
    case 'advance_day':
      return {
        selectedDecisionId: null,
        mutationHighlight: 'advance_day',
      };
    default:
      return null;
  }
}
