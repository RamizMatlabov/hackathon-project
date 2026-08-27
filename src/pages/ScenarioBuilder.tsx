import { Logo } from '../components/Logo';
import type { RiskTolerance, ScenarioDraft } from '../types';

interface ScenarioBuilderProps {
  draft: ScenarioDraft;
  valid: boolean;
  onChange: <K extends keyof ScenarioDraft>(key: K, value: ScenarioDraft[K]) => void;
  onBack: () => void;
  onStart: () => void;
  onPrefill: () => void;
}

export function ScenarioBuilder({
  draft,
  valid,
  onChange,
  onBack,
  onStart,
  onPrefill,
}: ScenarioBuilderProps) {
  return (
    <div className="page builder">
      <header className="topbar">
        <Logo compact onClick={onBack} />
        <div className="topbar__actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
          <button type="button" className="btn btn--secondary" onClick={onPrefill}>
            Load sample values
          </button>
          <button type="button" className="btn btn--primary" disabled={!valid} onClick={onStart}>
            Start Simulation
          </button>
        </div>
      </header>

      <main className="builder__main">
        <div className="builder__intro">
          <p className="eyebrow">Scenario builder</p>
          <h1>Frame the situation</h1>
          <p>
            Capture the goal, constraints, and operating reality. LifeSim turns this into a live
            simulation you can steer with decisions.
          </p>
        </div>

        <form
          className="builder__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) onStart();
          }}
        >
          <fieldset className="builder__section">
            <legend>Identity</legend>
            <label className="field">
              <span>Scenario name</span>
              <input
                value={draft.name}
                onChange={(e) => onChange('name', e.target.value)}
                placeholder="e.g. Product Launch Sprint"
                required
              />
            </label>
            <label className="field">
              <span>Main goal</span>
              <input
                value={draft.goalTitle}
                onChange={(e) => onChange('goalTitle', e.target.value)}
                placeholder="What must be true by the deadline?"
                required
              />
            </label>
            <label className="field">
              <span>Goal description</span>
              <textarea
                value={draft.goalDescription}
                onChange={(e) => onChange('goalDescription', e.target.value)}
                rows={3}
                placeholder="Context, stakeholders, and desired outcome"
              />
            </label>
            <label className="field">
              <span>Success criteria (one per line)</span>
              <textarea
                value={draft.successCriteria}
                onChange={(e) => onChange('successCriteria', e.target.value)}
                rows={3}
                placeholder={'Core journeys work end-to-end\nCritical bugs resolved'}
              />
            </label>
          </fieldset>

          <fieldset className="builder__section">
            <legend>Time & risk</legend>
            <div className="field-row">
              <label className="field">
                <span>Deadline (days)</span>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={draft.deadlineDays}
                  onChange={(e) => onChange('deadlineDays', Number(e.target.value))}
                  required
                />
              </label>
              <label className="field">
                <span>Risk tolerance</span>
                <select
                  value={draft.riskTolerance}
                  onChange={(e) => onChange('riskTolerance', e.target.value as RiskTolerance)}
                >
                  <option value="low">Low — protect stability</option>
                  <option value="medium">Medium — balanced</option>
                  <option value="high">High — favor speed</option>
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="builder__section">
            <legend>Operating model</legend>
            <label className="field">
              <span>Available resources (one per line)</span>
              <textarea
                value={draft.resourcesText}
                onChange={(e) => onChange('resourcesText', e.target.value)}
                rows={4}
                placeholder={'Budget: 48000 USD\nCloud credits: 5000 USD\nSchedule buffer: 3 days'}
              />
            </label>
            <label className="field">
              <span>People / team members (Name — Role)</span>
              <textarea
                value={draft.teamText}
                onChange={(e) => onChange('teamText', e.target.value)}
                rows={4}
                placeholder={'Maya Chen — Product Lead\nJordan Hale — Frontend Engineer'}
              />
            </label>
            <label className="field">
              <span>Constraints (one per line)</span>
              <textarea
                value={draft.constraintsText}
                onChange={(e) => onChange('constraintsText', e.target.value)}
                rows={3}
                placeholder={'Privacy review required\nNo permanent hires'}
              />
            </label>
          </fieldset>

          <div className="builder__footer">
            <p className="builder__hint">
              {valid
                ? 'Ready to initialize the simulation workspace.'
                : 'Add a scenario name, goal, and deadline to continue.'}
            </p>
            <button type="submit" className="btn btn--primary btn--lg" disabled={!valid}>
              Start Simulation
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
