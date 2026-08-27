/**
 * Application action surface for LifeSim.
 *
 * These functions are the stable entry points that future WebMCP tools
 * will call. UI and agents should prefer this module over reaching into
 * React state or engine internals.
 */
import type {
  Resource,
  Scenario,
  ScenarioDraft,
  SimulationState,
  Task,
  TeamMember,
} from '../types';
import {
  addResource as engineAddResource,
  addTask as engineAddTask,
  addTeamMember as engineAddTeamMember,
  applyDecision as engineApplyDecision,
  changeDeadline as engineChangeDeadline,
  createSimulationFromScenario,
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
