import type { SimulationState } from '../types';
import type {
  WebMCPToolErrorCode,
  WebMCPToolFailure,
  WebMCPToolSuccess,
} from './types';
import type { SimulationBridge } from './types';

export function toolOk<T>(data: T): WebMCPToolSuccess<T> {
  return { success: true, data };
}

export function toolErr(
  code: WebMCPToolErrorCode,
  error: string,
): WebMCPToolFailure {
  return { success: false, code, error };
}

export function requireSimulation<T>(
  state: T | null,
  message = 'No active simulation. Open or start a scenario in LifeSim first.',
): WebMCPToolFailure | null {
  if (state == null) {
    return toolErr('NO_SIMULATION', message);
  }
  return null;
}

export function getActiveSimulation(
  bridge: SimulationBridge,
): SimulationState | WebMCPToolFailure {
  const state = bridge.getState();
  if (!state) {
    return toolErr('NO_SIMULATION', 'No active simulation. Open or start a scenario in LifeSim first.');
  }
  return state;
}

export function requireString(
  value: unknown,
  field: string,
): string | WebMCPToolFailure {
  if (typeof value !== 'string' || value.trim() === '') {
    return toolErr('INVALID_INPUT', `"${field}" must be a non-empty string.`);
  }
  return value.trim();
}

export function requireNumber(
  value: unknown,
  field: string,
  options?: { min?: number; integer?: boolean },
): number | WebMCPToolFailure {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return toolErr('INVALID_INPUT', `"${field}" must be a number.`);
  }
  if (options?.integer && !Number.isInteger(value)) {
    return toolErr('INVALID_INPUT', `"${field}" must be an integer.`);
  }
  if (options?.min != null && value < options.min) {
    return toolErr('INVALID_INPUT', `"${field}" must be at least ${options.min}.`);
  }
  return value;
}

export function isToolFailure<T>(value: T | WebMCPToolFailure): value is WebMCPToolFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as WebMCPToolFailure).success === false
  );
}
