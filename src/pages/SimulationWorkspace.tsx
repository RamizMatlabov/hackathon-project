import { ActivityLog } from '../components/ActivityLog';
import { DecisionPanel } from '../components/DecisionPanel';
import { Logo } from '../components/Logo';
import { ProbabilityMeter, StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import {
  ResourceList,
  RiskList,
  TaskBoard,
  TeamList,
} from '../components/WorkspacePanels';
import type { SimulationState } from '../types';
import { formatDay } from '../utils/helpers';

interface SimulationWorkspaceProps {
  state: SimulationState;
  onHome: () => void;
  onDecide: (decisionId: string) => void;
  onAdvanceDay: () => void;
}

export function SimulationWorkspace({
  state,
  onHome,
  onDecide,
  onAdvanceDay,
}: SimulationWorkspaceProps) {
  const canAdvance = state.day < state.deadlineDays;

  return (
    <div className="page workspace">
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
            Advance day
          </button>
          <button type="button" className="btn btn--ghost" onClick={onHome}>
            Exit to home
          </button>
        </div>
      </header>

      <main className="workspace__main">
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
            <p className="command-card__note">Risk tolerance: {state.riskTolerance}</p>
          </div>

          <div className="command-card command-card--probability">
            <ProbabilityMeter value={state.successProbability} />
          </div>
        </section>

        <Timeline day={state.day} deadlineDays={state.deadlineDays} tasks={state.tasks} />

        <div className="workspace__grid">
          <div className="workspace__col workspace__col--primary">
            <DecisionPanel
              decisions={state.availableDecisions}
              lastConsequence={state.lastConsequence}
              onDecide={onDecide}
            />
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
