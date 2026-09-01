import type { Scenario } from '../types';
import { Logo } from '../components/Logo';
import { AGENT_DEMO_SCENARIO_NAME } from '../webmcp/agentDemoPlaybook';

interface DashboardProps {
  scenarios: Scenario[];
  onCreate: () => void;
  onCreateFromTemplate: () => void;
  onOpenAgentDemo: () => void;
  onOpenScenario: (id: string) => void;
}

export function Dashboard({
  scenarios,
  onCreate,
  onCreateFromTemplate,
  onOpenAgentDemo,
  onOpenScenario,
}: DashboardProps) {
  return (
    <div className="page dashboard">
      <header className="topbar">
        <Logo />
        <nav className="topbar__actions" aria-label="Primary">
          <button type="button" className="btn btn--ghost" onClick={onCreateFromTemplate}>
            Use launch template
          </button>
          <button type="button" className="btn btn--primary" onClick={onCreate}>
            Create Scenario
          </button>
        </nav>
      </header>

      <main className="dashboard__main">
        <section className="hero-sim" aria-labelledby="hero-title">
          <div className="hero-sim__copy">
            <p className="eyebrow">Interactive decision simulation</p>
            <h1 id="hero-title">LifeSim</h1>
            <p className="hero-sim__lede">
              Model a real situation, make decisions under constraints, and watch risks, resources,
              and outcomes shift in a live simulation workspace.
            </p>
            <div className="hero-sim__cta">
              <button type="button" className="btn btn--primary btn--lg" onClick={onCreate}>
                Create Scenario
              </button>
              <button type="button" className="btn btn--secondary btn--lg" onClick={onOpenAgentDemo}>
                Start agent demo
              </button>
              <button type="button" className="btn btn--ghost btn--lg" onClick={onCreateFromTemplate}>
                Start with sample launch
              </button>
            </div>
            <p className="hero-sim__hint">
              <strong>Start agent demo</strong> opens <em>Launch a Student Innovation Project</em> with
              a 3-step WebMCP playbook for Chrome&apos;s Model Context Tool Inspector.
            </p>
          </div>

          <div className="hero-sim__visual" aria-hidden="true">
            <div className="sim-grid">
              <div className="sim-grid__node sim-grid__node--goal">Goal</div>
              <div className="sim-grid__node sim-grid__node--risk">Risk</div>
              <div className="sim-grid__node sim-grid__node--team">Team</div>
              <div className="sim-grid__node sim-grid__node--time">Time</div>
              <div className="sim-grid__pulse" />
              <div className="sim-grid__link sim-grid__link--1" />
              <div className="sim-grid__link sim-grid__link--2" />
              <div className="sim-grid__link sim-grid__link--3" />
            </div>
          </div>
        </section>

        <section className="dashboard__lower" aria-labelledby="recent-heading">
          <div className="dashboard__about">
            <h2>How it works</h2>
            <ol className="steps">
              <li>
                <strong>Define the scenario</strong>
                <span>Goal, deadline, people, resources, and hard constraints.</span>
              </li>
              <li>
                <strong>Enter the workspace</strong>
                <span>Track timeline pressure, risks, and success probability in one view.</span>
              </li>
              <li>
                <strong>Decide and adapt</strong>
                <span>Every intervention updates the simulation state and activity log.</span>
              </li>
            </ol>
          </div>

          <div className="dashboard__recent">
            <div className="section-head">
              <h2 id="recent-heading">Recent scenarios</h2>
              <p>Resume a simulation or inspect its current framing.</p>
            </div>

            {scenarios.length === 0 ? (
              <p className="empty-note">No scenarios yet. Create one to begin.</p>
            ) : (
              <ul className="scenario-list">
                {scenarios.map((scenario) => (
                  <li key={scenario.id}>
                    <button
                      type="button"
                      className={`scenario-card${scenario.name === AGENT_DEMO_SCENARIO_NAME ? ' scenario-card--featured' : ''}`}
                      onClick={() => onOpenScenario(scenario.id)}
                    >
                      <div>
                        <strong>{scenario.name}</strong>
                        <p>{scenario.goal.title}</p>
                      </div>
                      <div className="scenario-card__meta">
                        <span>{scenario.deadlineDays} days</span>
                        <span>{scenario.team.length} people</span>
                        <span className="scenario-card__open">Open simulation →</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
