import { useMemo, useState } from 'react';
import {
  AGENT_DEMO_PLAYBOOK_BEATS,
  countCompletedBeats,
  derivePlaybookCompletion,
  isBeatComplete,
  PLAYBOOK_TOOL_SEMANTICS,
} from '../webmcp/agentDemoPlaybook';
import type { WebMCPDebugEntry } from '../webmcp/types';

interface AgentDemoPlaybookProps {
  agentActivity: WebMCPDebugEntry[];
  playbookSince: number;
}

export function AgentDemoPlaybook({ agentActivity, playbookSince }: AgentDemoPlaybookProps) {
  const [open, setOpen] = useState(true);
  const [copiedBeatId, setCopiedBeatId] = useState<string | null>(null);

  const completedTools = useMemo(
    () => derivePlaybookCompletion(agentActivity, playbookSince),
    [agentActivity, playbookSince],
  );
  const completedBeatCount = countCompletedBeats(completedTools);
  const allComplete = completedBeatCount === AGENT_DEMO_PLAYBOOK_BEATS.length;

  const copyPrompt = async (beatId: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedBeatId(beatId);
      window.setTimeout(() => setCopiedBeatId(null), 2000);
    } catch {
      setCopiedBeatId(null);
    }
  };

  return (
    <section className="agent-playbook" aria-label="Agent demo playbook">
      <button
        type="button"
        className="agent-playbook__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="agent-playbook__toggle-label">
          Agent Demo Playbook
          <span className="agent-playbook__progress">
            {completedBeatCount}/{AGENT_DEMO_PLAYBOOK_BEATS.length} beats
          </span>
        </span>
        <span className="agent-playbook__toggle-hint">
          {allComplete ? 'Demo complete' : 'Use Chrome Model Context Tool Inspector'}
        </span>
      </button>

      {open && (
        <div className="agent-playbook__panel">
          <p className="agent-playbook__intro">
            Copy each prompt into your external WebMCP agent. Steps check off when the
            corresponding tool call succeeds in Agent activity.
          </p>

          <ol className="agent-playbook__beats">
            {AGENT_DEMO_PLAYBOOK_BEATS.map((beat) => {
              const beatComplete = isBeatComplete(beat, completedTools);
              const active =
                !beatComplete &&
                AGENT_DEMO_PLAYBOOK_BEATS.find((item) => !isBeatComplete(item, completedTools))
                  ?.id === beat.id;

              return (
                <li
                  key={beat.id}
                  className={`agent-playbook__beat${beatComplete ? ' is-complete' : ''}${active ? ' is-active' : ''}`}
                >
                  <header className="agent-playbook__beat-header">
                    <span className="agent-playbook__beat-step">Beat {beat.step}</span>
                    <strong className="agent-playbook__beat-title">{beat.title}</strong>
                    {beatComplete && (
                      <span className="agent-playbook__beat-check" aria-label="Beat complete">
                        ✓
                      </span>
                    )}
                  </header>

                  <div className="agent-playbook__prompt-row">
                    <blockquote className="agent-playbook__prompt">{beat.prompt}</blockquote>
                    <button
                      type="button"
                      className="btn btn--ghost agent-playbook__copy"
                      onClick={() => void copyPrompt(beat.id, beat.prompt)}
                    >
                      {copiedBeatId === beat.id ? 'Copied' : 'Copy prompt'}
                    </button>
                  </div>

                  <ul className="agent-playbook__tools" aria-label={`Expected tools for beat ${beat.step}`}>
                    {beat.tools.map((tool) => {
                      const toolComplete = completedTools.has(tool);
                      const semantics = PLAYBOOK_TOOL_SEMANTICS[tool];
                      return (
                        <li
                          key={tool}
                          className={`agent-playbook__tool${toolComplete ? ' is-complete' : ''}`}
                        >
                          <span className="agent-playbook__tool-status" aria-hidden="true">
                            {toolComplete ? '✓' : '○'}
                          </span>
                          <code>{tool}</code>
                          {semantics && (
                            <span className="agent-playbook__tool-semantics">{semantics}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
