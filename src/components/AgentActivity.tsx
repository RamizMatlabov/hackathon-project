import type { WebMCPDebugEntry } from '../webmcp/types';

interface AgentActivityProps {
  entries: WebMCPDebugEntry[];
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function decisionTitleFromResult(entry: WebMCPDebugEntry): string | null {
  if (!entry.result.success) return null;
  const data = asObject(entry.result.data);
  if (!data) return null;

  if (typeof data.decisionTitle === 'string' && data.decisionTitle.length > 0) {
    return data.decisionTitle;
  }

  if (typeof data.actionDetail === 'string') {
    const match = /^Applied:\s*(.+)$/i.exec(data.actionDetail);
    if (match?.[1]) return match[1];
  }

  return null;
}

function formatPrimaryLabel(entry: WebMCPDebugEntry): string {
  const { tool, result } = entry;

  if (!result.success) {
    return `Agent tool failed: ${tool}`;
  }

  switch (tool) {
    case 'get_simulation_state':
      return 'Agent analyzed the simulation';
    case 'get_available_decisions':
      return 'Agent listed available decisions';
    case 'simulate':
      return 'Agent recalculated projections';
    case 'compare_scenario_branch':
      return 'Agent compared two strategies';
    case 'preview_decision': {
      const title = decisionTitleFromResult(entry) ?? 'a decision';
      return `Agent previewed ${title}`;
    }
    case 'apply_decision': {
      const title = decisionTitleFromResult(entry) ?? 'a decision';
      return `Agent applied ${title}`;
    }
    case 'advance_day':
      return 'Agent advanced the simulation';
    case 'change_deadline':
      return 'Agent changed the deadline';
    case 'add_task':
      return 'Agent added a task';
    case 'remove_task':
      return 'Agent removed a task';
    case 'add_resource':
      return 'Agent added a resource';
    case 'add_team_member':
      return 'Agent added a team member';
    default:
      return `Agent called ${tool}`;
  }
}

function formatDetail(entry: WebMCPDebugEntry): string | null {
  if (!entry.result.success) {
    return entry.result.error;
  }

  if (entry.tool === 'preview_decision') {
    return 'Read-only preview — awaiting human confirmation before apply.';
  }

  if (entry.tool === 'apply_decision') {
    return 'Mutation committed to the live simulation.';
  }

  if (entry.tool === 'compare_scenario_branch') {
    return 'Branch comparison — read-only, no state change.';
  }

  return null;
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
        <p className="agent-activity__flow">
          Agent analyzes → previews → human confirms → simulation changes
        </p>
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
      <p className="agent-activity__flow">
        Agent analyzes → previews → human confirms → simulation changes
      </p>
      <ol className="agent-activity__list">
        {visible.map((entry) => {
          const label = formatPrimaryLabel(entry);
          const detail = formatDetail(entry);
          const isError = !entry.result.success;

          return (
            <li
              key={entry.id}
              className={`agent-activity__item${isError ? ' is-error' : ''}`}
            >
              <span className="agent-activity__icon" aria-hidden="true">
                {isError ? '⚠️' : '🤖'}
              </span>
              <div>
                <strong>{label}</strong>
                {detail && <span className="agent-activity__detail">{detail}</span>}
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
