/**
 * Application action surface for LifeSim.
 *
 * Stable, JSON-serializable entry points for UI and future WebMCP tools.
 * Prefer this module over reaching into React state or engine internals.
 */
import type {
  Resource,
  Scenario,
  ScenarioCompareResult,
  ScenarioDraft,
  SimulationState,
  Task,
  TeamMember,
} from '../types';
import { compareScenarios } from './compare';
import {
  addResource as engineAddResource,
  addTask as engineAddTask,
  addTeamMember as engineAddTeamMember,
  advanceDay as engineAdvanceDay,
  applyDecision as engineApplyDecision,
  changeDeadline as engineChangeDeadline,
  createSimulationFromScenario,
  getAvailableDecisions as engineGetAvailableDecisions,
  getSimulationState as engineGetSimulationState,
  previewDecision as enginePreviewDecision,
  removeTask as engineRemoveTask,
  simulate as engineSimulate,
} from './engine';
import { draftToScenario } from '../utils/scenarioFactory';

export function createScenario(draft: ScenarioDraft): Scenario {
  return draftToScenario(draft);
}

export function startSimulation(scenario: Scenario): SimulationState {
  return createSimulationFromScenario(scenario);
}

export function getSimulationState(state: SimulationState): SimulationState {
  return engineGetSimulationState(state);
}

export function previewDecision(state: SimulationState, decisionId: string) {
  return enginePreviewDecision(state, decisionId);
}

export function applyDecision(state: SimulationState, decisionId: string): SimulationState {
  return engineApplyDecision(state, decisionId);
}

export function changeDeadline(state: SimulationState, days: number): SimulationState {
  return engineChangeDeadline(state, days);
}

export function addTask(
  state: SimulationState,
  task: Omit<Task, 'id'> & { id?: string },
): SimulationState {
  return engineAddTask(state, task);
}

export function removeTask(state: SimulationState, taskId: string): SimulationState {
  return engineRemoveTask(state, taskId);
}

export function addResource(
  state: SimulationState,
  resource: Omit<Resource, 'id'> & { id?: string },
): SimulationState {
  return engineAddResource(state, resource);
}

export function addTeamMember(
  state: SimulationState,
  member: Omit<TeamMember, 'id'> & { id?: string },
): SimulationState {
  return engineAddTeamMember(state, member);
}

export function simulate(state: SimulationState): SimulationState {
  return engineSimulate(state);
}

export function advanceDay(state: SimulationState): SimulationState {
  return engineAdvanceDay(state);
}

export function getAvailableDecisions(state: SimulationState) {
  return engineGetAvailableDecisions(state);
}

export function compareScenarioBranch(
  state: SimulationState,
  decisionId: string | null,
): ScenarioCompareResult {
  return compareScenarios(state, decisionId);
}

/** Materialize a temporary branch by applying a decision (does not touch caller's state). */
export function createScenarioBranch(
  state: SimulationState,
  decisionId: string,
): SimulationState | null {
  const decision = state.availableDecisions.find((d) => d.id === decisionId);
  if (!decision || !decision.available) return null;
  return engineApplyDecision(state, decisionId);
}
