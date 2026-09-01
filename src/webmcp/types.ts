import type { SimulationState } from '../types';

export type WebMCPToolCategory = 'observe' | 'analyze' | 'act';

export type WebMCPToolName =
  | 'get_simulation_state'
  | 'get_available_decisions'
  | 'preview_decision'
  | 'compare_scenario_branch'
  | 'simulate'
  | 'apply_decision'
  | 'advance_day'
  | 'change_deadline'
  | 'add_task'
  | 'remove_task'
  | 'add_resource'
  | 'add_team_member';

export type WebMCPToolErrorCode =
  | 'NO_SIMULATION'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'DECISION_UNAVAILABLE'
  | 'PREVIEW_STALE'
  | 'PREVIEW_NOT_FOUND'
  | 'PREVIEW_MISMATCH'
  | 'TASK_ALREADY_COMPLETED'
  | 'DEADLINE_REACHED';

export interface WebMCPToolSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface WebMCPToolFailure {
  success: false;
  error: string;
  code: WebMCPToolErrorCode;
}

export type WebMCPToolResult<T = unknown> = WebMCPToolSuccess<T> | WebMCPToolFailure;

export interface SimulationBridge {
  getState: () => SimulationState | null;
  setState: (updater: (prev: SimulationState | null) => SimulationState | null) => void;
}

export type WebMCPStatus =
  | 'unsupported'
  | 'available'
  | 'registering'
  | 'ready'
  | 'registration_error';

export type WebMCPCapabilityState = 'available' | 'unavailable';

export interface WebMCPCapabilities {
  modelContext: WebMCPCapabilityState;
  registerTool: WebMCPCapabilityState;
  getTools: WebMCPCapabilityState;
}

export interface WebMCPFailedTool {
  name: string;
  error: string;
}

export interface WebMCPRegistrationInfo {
  status: WebMCPStatus;
  capabilities: WebMCPCapabilities;
  expectedToolCount: number;
  registeredToolCount: number;
  registeredToolNames: string[];
  failedTools: WebMCPFailedTool[];
  verifiedViaGetTools: boolean;
  browserRequirement: string;
  error?: string;
}

export interface WebMCPSelfTestStep {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface WebMCPSelfTestResult {
  ranAt: number;
  supported: boolean;
  steps: WebMCPSelfTestStep[];
  summary: string;
}

export interface WebMCPDebugEntry {
  id: string;
  timestamp: number;
  tool: WebMCPToolName | string;
  category: WebMCPToolCategory;
  readOnly: boolean;
  args: unknown;
  result: WebMCPToolResult;
  durationMs: number;
}

export type AgentMutationHighlight = 'apply_decision' | 'advance_day';

/** Workspace UI intent emitted after agent tool calls that should mirror in the main UI. */
export interface AgentUISyncIntent {
  seq: number;
  selectedDecisionId?: string | null;
  branchDecisionId?: string | null;
  branchVersusDecisionId?: string | null;
  mutationHighlight?: AgentMutationHighlight;
}

/** Live workspace selection/compare state (user + agent). */
export interface WorkspaceUIState {
  selectedDecisionId: string | null;
  branchDecisionId: string | null;
  branchVersusDecisionId: string | null;
  mutationHighlight: AgentMutationHighlight | null;
}
