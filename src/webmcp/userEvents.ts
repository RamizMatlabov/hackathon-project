import type { SimulationState } from '../types';
import { generateSimulationEvent } from '../simulation/emergentEvents';

/** Prepend a visible activity-log entry when the user mutates simulation state via UI. */
export function appendUserActionEvent(
  state: SimulationState,
  detail: string,
): SimulationState {
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'system',
    title: 'User action',
    description: detail,
    impact: 'Simulation updated manually in the workspace',
    seq: 8000 + state.events.length,
    actorSource: 'user',
  });

  return {
    ...state,
    events: [event, ...state.events],
  };
}
