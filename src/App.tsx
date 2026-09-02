import { useLifeSimApp } from './hooks/useLifeSimApp';
import { useWebMCP } from './hooks/useWebMCP';
import { Dashboard } from './pages/Dashboard';
import { ScenarioBuilder } from './pages/ScenarioBuilder';
import { SimulationWorkspace } from './pages/SimulationWorkspace';
import { WebMCPDebugPanel } from './components/WebMCPDebugPanel';
import { WebMCPStatus } from './components/WebMCPStatus';

export default function App() {
  const app = useLifeSimApp();
  const webmcp = useWebMCP(app.simulation, app.setSimulation, app.simulationSessionKey);

  const chrome = (
    <>
      <WebMCPStatus
        registration={webmcp.registration}
        hasSimulation={app.simulation != null}
      />
      <WebMCPDebugPanel
        registration={webmcp.registration}
        entries={webmcp.debugLog}
        selfTest={webmcp.selfTest}
        selfTestRunning={webmcp.selfTestRunning}
        onRunSelfTest={webmcp.runSelfTest}
        onClear={webmcp.clearDebugLog}
      />
    </>
  );

  if (app.view === 'builder') {
    return (
      <>
        {chrome}
        <ScenarioBuilder
          draft={app.draft}
          valid={app.draftValid}
          onChange={app.updateDraft}
          onBack={app.openDashboard}
          onStart={app.startFromDraft}
          onPrefill={() => app.openBuilder(true)}
        />
      </>
    );
  }

  if (app.view === 'simulation' && app.simulation) {
    return (
      <>
        {chrome}
        <SimulationWorkspace
          state={app.simulation}
          agentActivity={webmcp.debugLog}
          playbookSince={webmcp.playbookSince}
          workspaceUI={webmcp.workspaceUI}
          onSelectDecision={webmcp.setSelectedDecisionId}
          onSelectBranch={(id) => webmcp.setBranchCompare(id, null)}
          onClearBranch={webmcp.clearBranchCompare}
          onConfirmAgentRecommendation={webmcp.confirmAgentRecommendation}
          onDismissAgentRecommendation={webmcp.dismissAgentRecommendation}
          onHome={app.openDashboard}
          onDecide={app.makeDecision}
          onAdvanceDay={app.stepDay}
          onSimulate={app.recalculate}
        />
      </>
    );
  }

  return (
    <>
      {chrome}
      <Dashboard
        scenarios={app.scenarios}
        onCreate={() => app.openBuilder(false)}
        onCreateFromTemplate={() => app.openBuilder(true)}
        onOpenAgentDemo={app.openAgentDemo}
        onOpenScenario={app.openScenario}
      />
    </>
  );
}
