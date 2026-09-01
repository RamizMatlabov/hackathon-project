import type { WebMCPDebugEntry } from './types';

export const AGENT_DEMO_SCENARIO_NAME = 'Launch a Student Innovation Project';

export type PlaybookToolName =
  | 'get_simulation_state'
  | 'compare_scenario_branch'
  | 'preview_decision'
  | 'apply_decision'
  | 'advance_day';

export interface PlaybookBeat {
  id: 'observe' | 'compare' | 'act';
  step: number;
  title: string;
  prompt: string;
  tools: PlaybookToolName[];
}

export const AGENT_DEMO_PLAYBOOK_BEATS: PlaybookBeat[] = [
  {
    id: 'observe',
    step: 1,
    title: 'Observe',
    prompt:
      "We're preparing for a student innovation showcase. What's our situation — are we on track?",
    tools: ['get_simulation_state'],
  },
  {
    id: 'compare',
    step: 2,
    title: 'Compare',
    prompt:
      'Compare reducing scope vs adding a team member. Which is better for success?',
    tools: ['compare_scenario_branch'],
  },
  {
    id: 'act',
    step: 3,
    title: 'Act',
    prompt: 'Preview your recommendation, apply it, then advance one day.',
    tools: ['preview_decision', 'apply_decision', 'advance_day'],
  },
];

const PLAYBOOK_TOOLS = new Set<PlaybookToolName>(
  AGENT_DEMO_PLAYBOOK_BEATS.flatMap((beat) => beat.tools),
);

export function isAgentDemoScenario(scenarioName: string): boolean {
  return scenarioName === AGENT_DEMO_SCENARIO_NAME;
}

function isPlaybookTool(tool: string): tool is PlaybookToolName {
  return PLAYBOOK_TOOLS.has(tool as PlaybookToolName);
}

/** Derive completed playbook tools from real WebMCP debug entries (successful calls only). */
export function derivePlaybookCompletion(entries: WebMCPDebugEntry[]): Set<PlaybookToolName> {
  const completed = new Set<PlaybookToolName>();

  for (const entry of entries) {
    if (!entry.result.success || !isPlaybookTool(entry.tool)) continue;
    completed.add(entry.tool);
  }

  return completed;
}

export function isBeatComplete(beat: PlaybookBeat, completed: Set<PlaybookToolName>): boolean {
  return beat.tools.every((tool) => completed.has(tool));
}

export function countCompletedBeats(completed: Set<PlaybookToolName>): number {
  return AGENT_DEMO_PLAYBOOK_BEATS.filter((beat) => isBeatComplete(beat, completed)).length;
}
