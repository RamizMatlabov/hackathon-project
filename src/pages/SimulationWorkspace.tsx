import { useMemo } from 'react';
import { ActivityLog } from '../components/ActivityLog';
import { AgentActivity } from '../components/AgentActivity';
import { BeforeAfterCompare } from '../components/BeforeAfterCompare';
import { DecisionPanel } from '../components/DecisionPanel';
import { ImpactAnalysis } from '../components/ImpactAnalysis';
import { Logo } from '../components/Logo';
import { MetricsPanel } from '../components/MetricsPanel';
import { RecentChangesPanel } from '../components/RecentChangesPanel';
import { ScenarioCompare } from '../components/ScenarioCompare';
import { ProbabilityMeter, StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { WhatHappensNext } from '../components/WhatHappensNext';
import { WorldStatePanel } from '../components/WorldStatePanel';
import {
  ResourceList,
  RiskList,
  TaskBoard,
  TeamList,
} from '../components/WorkspacePanels';
import { compareScenarioBranch, previewDecision } from '../simulation/actions';
import type { SimulationState } from '../types';
import type { WebMCPDebugEntry, WorkspaceUIState } from '../webmcp/types';
import { formatDay } from '../utils/helpers';

interface SimulationWorkspaceProps {
  state: SimulationState;
  agentActivity: WebMCPDebugEntry[];
  workspaceUI: WorkspaceUIState;
  onSelectDecision: (decisionId: string | null) => void;
  onSelectBranch: (decisionId: string | null) => void;
  onClearBranch: () => void;
  onHome: () => void;
  onDecide: (decisionId: string) => void;
  onAdvanceDay: () => void;
  onSimulate: () => void;
}

export function SimulationWorkspace({
  state,
  agentActivity,
  workspaceUI,
  onSelectDecision,
  onSelectBranch,
  onClearBranch,
  onHome,
  onDecide,
  onAdvanceDay,
  onSimulate,
}: SimulationWorkspaceProps) {
  const { selectedDecisionId, branchDecisionId, branchVersusDecisionId, mutationHighlight } =
    workspaceUI;
  const canAdvance = state.day < state.deadlineDays;

  const preview = useMemo(() => {
    if (!selectedDecisionId) return null;
    return previewDecision(state, selectedDecisionId);
  }, [selectedDecisionId, state]);

  const branchCompare = useMemo(() => {
    if (!branchDecisionId) return null;
    return compareScenarioBranch(state, branchDecisionId, branchVersusDecisionId);
  }, [branchDecisionId, branchVersusDecisionId, state]);

  const handleSelect = (decisionId: string) => {
    onSelectDecision(selectedDecisionId === decisionId ? null : decisionId);
  };

  const handleCancel = () => {
    onSelectDecision(null);
  };

  const handleApply = () => {
    if (!selectedDecisionId) return;
    onDecide(selectedDecisionId);
    onSelectDecision(null);
  };

  const handleSelectBranch = (decisionId: string | null) => {
    onSelectBranch(decisionId);
  };

  return (
    <div
      className={`page workspace${mutationHighlight ? ' workspace--agent-mutation' : ''}`}
      data-agent-mutation={mutationHighlight ?? undefined}
    >
      <header className="topbar topbar--workspace">
        <Logo compact onClick={onHome} />
        <div className="workspace__titleblock">
          <p className="eyebrow">Simulation workspace</p>
          <h1>{state.scenarioName}</h1>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={onAdvanceDay}
            disabled={!canAdvance}
          >
            Next Day
          </button>
          <button type="button" className="btn btn--ghost" onClick={onSimulate}>
            Recalculate
          </button>
          <button type="button" className="btn btn--ghost" onClick={onHome}>
            Exit to home
          </button>
        </div>
      </header>

      <main className="workspace__main">
        <nav className="sim-loop" aria-label="Simulation loop">
          <ol className="sim-loop__steps">
            <li className="is-active">Observe</li>
            <li className={selectedDecisionId ? 'is-active' : ''}>Decide</li>
            <li className={preview ? 'is-active' : ''}>Preview</li>
            <li>Apply</li>
            <li>Simulate</li>
            <li>Observe</li>
          </ol>
          <p className="sim-loop__hint">
            Observe → Decide → Preview → Apply → Next Day → Observe
          </p>
        </nav>

        <section className="workspace__command" aria-label="Scenario command bar">
          <div className="command-card command-card--goal">
            <span className="command-card__label">Goal</span>
            <strong>{state.goal.title}</strong>
            <p>{state.goal.description}</p>
            <ul className="criteria-list">
              {state.goal.successCriteria.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="command-card">
            <span className="command-card__label">Deadline</span>
            <strong className="command-card__stat">
              Day {state.day}
              <span> / {state.deadlineDays}</span>
            </strong>
            <p>{formatDay(state.day, state.deadlineDays)}</p>
          </div>

          <div className="command-card">
            <span className="command-card__label">Status</span>
            <StatusBadge status={state.status} />
            <p className="command-card__note">
              Risk tolerance: {state.riskTolerance} · {state.metrics.openTasks} open tasks
            </p>
          </div>

          <div className="command-card command-card--probability">
            <ProbabilityMeter value={state.metrics.successProbability} />
          </div>
        </section>

        <section className="workspace__world" aria-label="World observation">
          <WorldStatePanel state={state} />
          <AgentActivity entries={agentActivity} />
          <RecentChangesPanel changes={state.recentChanges} />
          <WhatHappensNext narrative={state.narrative} />
        </section>

        <MetricsPanel metrics={state.metrics} />

        <section className="workspace__sim-core" aria-label="Decision simulation core">
          <DecisionPanel
            decisions={state.availableDecisions}
            selectedDecisionId={selectedDecisionId}
            hasPreview={Boolean(preview)}
            lastConsequence={state.lastConsequence}
            onSelect={handleSelect}
            onApply={handleApply}
            onCancel={handleCancel}
          />
          <div className="workspace__sim-visual">
            <ImpactAnalysis preview={preview} />
            <BeforeAfterCompare preview={preview} />
          </div>
        </section>

        <ScenarioCompare
          compare={branchCompare}
          branchDecisionId={branchDecisionId}
          decisions={state.availableDecisions}
          onSelectBranch={handleSelectBranch}
          onClear={onClearBranch}
        />

        <Timeline day={state.day} deadlineDays={state.deadlineDays} tasks={state.tasks} />

        <div className="workspace__grid">
          <div className="workspace__col workspace__col--primary">
            <TaskBoard tasks={state.tasks} />
          </div>

          <div className="workspace__col workspace__col--side">
            <ResourceList resources={state.resources} />
            <TeamList team={state.team} />
            <RiskList risks={state.risks} />
            <ActivityLog events={state.events} />
          </div>
        </div>

        {state.constraints.length > 0 && (
          <section className="panel constraints-bar" aria-labelledby="constraints-heading">
            <header className="panel__header">
              <h2 id="constraints-heading">Constraints</h2>
              <p>Hard limits stay visible while you decide</p>
            </header>
            <ul className="constraint-chips">
              {state.constraints.map((c) => (
                <li key={c.id} className={c.hard ? 'is-hard' : ''}>
                  <strong>{c.label}</strong>
                  <span>{c.description}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
