import { useLifeSimApp } from './hooks/useLifeSimApp';
import { Dashboard } from './pages/Dashboard';
import { ScenarioBuilder } from './pages/ScenarioBuilder';
import { SimulationWorkspace } from './pages/SimulationWorkspace';

export default function App() {
  const app = useLifeSimApp();

  if (app.view === 'builder') {
    return (
      <ScenarioBuilder
        draft={app.draft}
        valid={app.draftValid}
        onChange={app.updateDraft}
        onBack={app.openDashboard}
        onStart={app.startFromDraft}
        onPrefill={() => app.openBuilder(true)}
      />
    );
  }

  if (app.view === 'simulation' && app.simulation) {
    return (
      <SimulationWorkspace
        state={app.simulation}
        onHome={app.openDashboard}
        onDecide={app.makeDecision}
        onAdvanceDay={app.stepDay}
        onSimulate={app.recalculate}
      />
    );
  }

  return (
    <Dashboard
      scenarios={app.scenarios}
      onCreate={() => app.openBuilder(false)}
      onCreateFromTemplate={() => app.openBuilder(true)}
      onOpenScenario={app.openScenario}
    />
  );
}
