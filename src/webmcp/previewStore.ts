import type { SimulationState } from '../types';
import type { WebMCPToolFailure } from './types';
import { toolErr } from './results';

interface PreviewRecord {
  previewId: string;
  simulationVersion: number;
  decisionId: string;
  decisionTitle: string;
  createdAt: number;
}

const previews = new Map<string, PreviewRecord>();
let previewCounter = 0;

/** Register a preview tied to the current simulation version. */
export function storePreview(
  state: SimulationState,
  decisionId: string,
  decisionTitle: string,
): string {
  const previewId = `prev_${++previewCounter}_${state.simulationVersion}`;
  previews.set(previewId, {
    previewId,
    simulationVersion: state.simulationVersion,
    decisionId,
    decisionTitle,
    createdAt: Date.now(),
  });
  return previewId;
}

/** Drop all previews — call after any live mutation. */
export function invalidateAllPreviews(): void {
  previews.clear();
}

export function validatePreviewForApply(
  previewId: string | undefined,
  state: SimulationState,
  decisionId: string,
): WebMCPToolFailure | null {
  if (!previewId) return null;

  const record = previews.get(previewId);
  if (!record) {
    return toolErr(
      'PREVIEW_NOT_FOUND',
      `No preview with id "${previewId}". Call preview_decision first to create a preview.`,
    );
  }
  if (record.decisionId !== decisionId) {
    return toolErr(
      'PREVIEW_MISMATCH',
      `Preview "${previewId}" was created for decision "${record.decisionId}", not "${decisionId}".`,
    );
  }
  if (record.simulationVersion !== state.simulationVersion) {
    return toolErr(
      'PREVIEW_STALE',
      `Preview "${previewId}" is outdated (created at simulation version ${record.simulationVersion}, current is ${state.simulationVersion}). Re-run preview_decision before applying.`,
    );
  }
  return null;
}

export function consumePreview(previewId: string | undefined): void {
  if (previewId) previews.delete(previewId);
}
