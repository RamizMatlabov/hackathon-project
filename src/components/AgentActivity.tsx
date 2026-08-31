import type { WebMCPDebugEntry } from '../webmcp/types';

interface AgentActivityProps {
  entries: WebMCPDebugEntry[];
}

const OBSERVE_TOOLS = new Set(['get_simulation_state', 'get_available_decisions', 'simulate']);

function formatEntry(entry: WebMCPDebugEntry): string {
  const { tool, result } = entry;

  if (!result.success) {
    return `Error in ${tool}: ${result.error}`;
  }

  if (OBSERVE_TOOLS.has(tool)) {
    return 'Agent is analyzing…';
  }

  if (tool === 'preview_decision') {
    const title =
      result.data &&
      typeof result.data === 'object' &&
      'decisionTitle' in result.data
        ? String((result.data as { decisionTitle: string }).decisionTitle)
        : 'decision';
    return `Previewed "${title}"`;
  }

  if (tool === 'compare_scenario_branch') {
    return 'Compared scenario branches';
  }

  if (tool === 'apply_decision') {
    const detail =
      result.data &&
      typeof result.data === 'object' &&
      'actionDetail' in result.data
        ? String((result.data as { actionDetail: string }).actionDetail)
        : 'Applied decision';
    return detail;
  }

  if (tool === 'advance_day') {
    return 'Advanced one day';
  }

  if (tool === 'change_deadline') {
    return 'Changed deadline';
  }

  if (tool === 'add_task') {
    return 'Added a task';
  }

  if (tool === 'remove_task') {
    return 'Removed a task';
  }

  if (tool === 'add_resource') {
    return 'Added a resource';
  }

  if (tool === 'add_team_member') {
    return 'Added a team member';
  }

  return `Called ${tool}`;
}

export function AgentActivity({ entries }: AgentActivityProps) {
  const visible = entries.slice(0, 8);

  if (visible.length === 0) {
    return (
      <section className="panel agent-activity" aria-label="Agent activity">
        <header className="panel__header">
          <h2>Agent activity</h2>
          <p>Real WebMCP tool calls appear here when an external agent interacts with LifeSim.</p>
        </header>
        <p className="agent-activity__empty">No agent activity yet.</p>
      </section>
    );
  }

  return (
    <section className="panel agent-activity" aria-label="Agent activity">
      <header className="panel__header">
        <h2>Agent activity</h2>
        <p>Live feed from WebMCP tool calls — not simulated.</p>
      </header>
      <ol className="agent-activity__list">
        {visible.map((entry) => {
          const label = formatEntry(entry);
          const isError = !entry.result.success;
          const isAnalyzing = OBSERVE_TOOLS.has(entry.tool) && entry.result.success;

          return (
            <li
              key={entry.id}
              className={`agent-activity__item${isError ? ' is-error' : ''}`}
            >
              <span className="agent-activity__icon" aria-hidden="true">
                {isError ? '⚠️' : '🤖'}
              </span>
              <div>
                <strong>
                  {isAnalyzing ? 'Agent is analyzing…' : label}
                </strong>
                <span className="agent-activity__meta">
                  {entry.tool}
                  {' · '}
                  {entry.readOnly ? 'read-only' : 'mutation'}
                  {' · '}
                  {entry.durationMs}ms
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
