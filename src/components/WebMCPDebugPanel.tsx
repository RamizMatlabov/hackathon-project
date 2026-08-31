import { useState } from 'react';
import type {
  WebMCPDebugEntry,
  WebMCPRegistrationInfo,
  WebMCPSelfTestResult,
} from '../webmcp/types';

interface WebMCPDebugPanelProps {
  registration: WebMCPRegistrationInfo;
  entries: WebMCPDebugEntry[];
  selfTest: WebMCPSelfTestResult | null;
  selfTestRunning: boolean;
  onRunSelfTest: () => Promise<WebMCPSelfTestResult>;
  onClear: () => void;
}

function capabilityLabel(state: 'available' | 'unavailable'): string {
  return state === 'available' ? 'available' : 'unavailable';
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function resultStatus(entry: WebMCPDebugEntry): string {
  return entry.result.success ? 'success' : `error (${entry.result.code})`;
}

export function WebMCPDebugPanel({
  registration,
  entries,
  selfTest,
  selfTestRunning,
  onRunSelfTest,
  onClear,
}: WebMCPDebugPanelProps) {
  const [open, setOpen] = useState(false);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <section className="webmcp-debug" aria-label="WebMCP developer debug panel">
      <button
        type="button"
        className="webmcp-debug__toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        WebMCP Debug ({registration.registeredToolCount}/{registration.expectedToolCount})
      </button>

      {open && (
        <div className="webmcp-debug__panel">
          <header className="webmcp-debug__header">
            <div>
              <strong>WebMCP diagnostics</strong>
              <p>Status: {registration.status}</p>
            </div>
            <div className="webmcp-debug__actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void onRunSelfTest()}
                disabled={selfTestRunning}
              >
                {selfTestRunning ? 'Running self-test…' : 'Run WebMCP self-test'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={onClear}>
                Clear log
              </button>
            </div>
          </header>

          <dl className="webmcp-debug__diagnostics">
            <div>
              <dt>API</dt>
              <dd>document.modelContext: {capabilityLabel(registration.capabilities.modelContext)}</dd>
            </div>
            <div>
              <dt>registerTool</dt>
              <dd>{capabilityLabel(registration.capabilities.registerTool)}</dd>
            </div>
            <div>
              <dt>getTools</dt>
              <dd>{capabilityLabel(registration.capabilities.getTools)}</dd>
            </div>
            <div>
              <dt>Registered tools</dt>
              <dd>
                {registration.registeredToolCount} / {registration.expectedToolCount}
                {registration.verifiedViaGetTools ? ' (verified via getTools)' : ''}
              </dd>
            </div>
            <div>
              <dt>Browser requirement</dt>
              <dd>{registration.browserRequirement}</dd>
            </div>
          </dl>

          {registration.error && (
            <p className="webmcp-debug__error">{registration.error}</p>
          )}

          {registration.failedTools.length > 0 && (
            <div className="webmcp-debug__failures">
              <span className="webmcp-debug__label">Registration failures</span>
              <ul>
                {registration.failedTools.map((failure) => (
                  <li key={failure.name}>
                    <strong>{failure.name}</strong>
                    <span>{failure.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="webmcp-debug__tools">
            <span className="webmcp-debug__label">Successfully registered</span>
            {registration.registeredToolNames.length === 0 ? (
              <p className="webmcp-debug__empty">No tools registered in this browser.</p>
            ) : (
              <ul>
                {registration.registeredToolNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>

          {selfTest && (
            <div className="webmcp-debug__self-test">
              <span className="webmcp-debug__label">WebMCP self-test</span>
              <p className="webmcp-debug__summary">{selfTest.summary}</p>
              <ul>
                {selfTest.steps.map((item) => (
                  <li key={item.id} className={item.passed ? 'is-pass' : 'is-fail'}>
                    <span>{item.passed ? '✓' : '✗'}</span>
                    <div>
                      <strong>{item.label}</strong>
                      {item.detail && <span>{item.detail}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="webmcp-debug__log">
            <span className="webmcp-debug__label">Recent calls</span>
            {entries.length === 0 ? (
              <p className="webmcp-debug__empty">No tool calls yet.</p>
            ) : (
              <ol>
                {entries.map((entry) => (
                  <li key={entry.id} className={entry.result.success ? '' : 'is-error'}>
                    <div className="webmcp-debug__call-meta">
                      <strong>{entry.tool}</strong>
                      <span>{entry.category}</span>
                      <span>{entry.readOnly ? 'read-only' : 'mutation'}</span>
                      <span>{resultStatus(entry)}</span>
                      <span>{formatTimestamp(entry.timestamp)}</span>
                      <span>{entry.durationMs}ms</span>
                    </div>
                    <pre>{JSON.stringify(entry.args, null, 2)}</pre>
                    <pre>{JSON.stringify(entry.result, null, 2)}</pre>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
