import type { SimulationState } from '../types';
import { generateSimulationEvent } from '../simulation/emergentEvents';

/** Prepend a visible activity-log entry when an agent mutates simulation state. */
export function appendAgentActionEvent(
  state: SimulationState,
  toolName: string,
  detail: string,
): SimulationState {
  const event = generateSimulationEvent({
    day: state.day,
    eventType: 'system',
    title: 'Agent action',
    description: `WebMCP tool "${toolName}" committed a change. ${detail}`,
    impact: 'Simulation updated by AI agent',
    seq: 9000 + state.events.length,
  });

  return {
    ...state,
    events: [event, ...state.events],
  };
}
