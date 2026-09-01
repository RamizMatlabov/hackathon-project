import { useCallback, useMemo, useState } from 'react';
import { DEMO_SCENARIOS } from '../data/mockScenarios';
import { AGENT_DEMO_SCENARIO_NAME } from '../webmcp/agentDemoPlaybook';
import {
  advanceDay,
  applyDecision,
  simulate,
  startSimulation as startSimAction,
} from '../simulation/actions';
import type { AppView, Scenario, ScenarioDraft, SimulationState } from '../types';
import { appendUserActionEvent } from '../webmcp/userEvents';
import {
  createDraftFromTemplate,
  createEmptyDraft,
  draftToScenario,
  isDraftValid,
} from '../utils/scenarioFactory';

export function useLifeSimApp() {
  const [view, setView] = useState<AppView>('dashboard');
  const [scenarios, setScenarios] = useState<Scenario[]>(() => DEMO_SCENARIOS);
  const [draft, setDraft] = useState<ScenarioDraft>(() => createEmptyDraft());
  const [simulation, setSimulation] = useState<SimulationState | null>(null);

  const recentScenarios = useMemo(
    () => [...scenarios].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    [scenarios],
  );

  const openDashboard = useCallback(() => {
    setView('dashboard');
  }, []);

  const openBuilder = useCallback((prefill = false) => {
    setDraft(prefill ? createDraftFromTemplate() : createEmptyDraft());
    setView('builder');
  }, []);

  const updateDraft = useCallback(<K extends keyof ScenarioDraft>(key: K, value: ScenarioDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const touchScenario = useCallback((id: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, lastOpenedAt: Date.now() } : s)),
    );
  }, []);

  const startSimulation = useCallback(
    (scenario: Scenario) => {
      const next = startSimAction(scenario);
      setSimulation(next);
      touchScenario(scenario.id);
      setView('simulation');
    },
    [touchScenario],
  );

  const startFromDraft = useCallback(() => {
    if (!isDraftValid(draft)) return;
    const scenario = draftToScenario(draft);
    setScenarios((prev) => [scenario, ...prev]);
    startSimulation(scenario);
  }, [draft, startSimulation]);

  const openScenario = useCallback(
    (id: string) => {
      const scenario = scenarios.find((s) => s.id === id);
      if (!scenario) return;
      startSimulation(scenario);
    },
    [scenarios, startSimulation],
  );

  const openAgentDemo = useCallback(() => {
    const scenario = scenarios.find((s) => s.name === AGENT_DEMO_SCENARIO_NAME);
    if (!scenario) return;
    startSimulation(scenario);
  }, [scenarios, startSimulation]);

  const makeDecision = useCallback((decisionId: string) => {
    setSimulation((prev) => {
      if (!prev) return prev;
      const decision = prev.availableDecisions.find((d) => d.id === decisionId);
      const next = applyDecision(prev, decisionId);
      if (!decision) return next;
      return appendUserActionEvent(next, `Applied: ${decision.title}`);
    });
  }, []);

  const stepDay = useCallback(() => {
    setSimulation((prev) => {
      if (!prev) return prev;
      if (prev.day >= prev.deadlineDays) return prev;
      const next = advanceDay(prev);
      return appendUserActionEvent(next, 'Advanced the simulation by one day.');
    });
  }, []);

  const recalculate = useCallback(() => {
    setSimulation((prev) => (prev ? simulate(prev) : prev));
  }, []);

  return {
    view,
    scenarios: recentScenarios,
    draft,
    simulation,
    setSimulation,
    draftValid: isDraftValid(draft),
    openDashboard,
    openBuilder,
    updateDraft,
    startFromDraft,
    openScenario,
    openAgentDemo,
    makeDecision,
    stepDay,
    recalculate,
  };
}
