import { createAgentDemoScenario } from '../src/data/mockScenarios.ts';
import { startSimulation } from '../src/simulation/actions.ts';
import { createLifeSimToolDefinitions } from '../src/webmcp/tools.ts';
import type { SimulationState } from '../src/types/index.ts';

let state: SimulationState | null = startSimulation(createAgentDemoScenario());

const bridge = {
  getState: () => state,
  setState: (updater: (prev: SimulationState | null) => SimulationState | null) => {
    state = updater(state);
  },
};

const tools = Object.fromEntries(
  createLifeSimToolDefinitions(bridge).map((d) => [d.name, d.handler]),
);

function assert(label: string, condition: boolean, detail = '') {
  const status = condition ? 'PASS' : 'FAIL';
  console.log(`${status}: ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) process.exitCode = 1;
}

const v0 = state!.simulationVersion;

// Test 1
const t1 = await tools.get_simulation_state({});
assert('Test 1 get_simulation_state', t1.success === true);
assert('Test 1 has simulationVersion', t1.success && t1.data.simulationVersion === v0);

// Test 2
const t2 = await tools.get_available_decisions({});
assert('Test 2 get_available_decisions', t2.success === true);
const decisions = t2.success ? t2.data.decisions : [];
assert('Test 2 has decisions', decisions.length > 0);

const reduceScope = decisions.find((d: { kind: string }) => d.kind === 'reduce_scope');
assert('Test 2 reduce_scope available', Boolean(reduceScope?.available));
const addMember = decisions.find((d: { kind: string }) => d.kind === 'add_team_member');

// Test 3
const versionBeforePreview = state!.simulationVersion;
const t3 = await tools.preview_decision({ decision_id: reduceScope!.id });
assert('Test 3 preview_decision', t3.success === true);
assert('Test 3 no mutation', state!.simulationVersion === versionBeforePreview);
const previewId = t3.success ? t3.data.previewId : null;
assert('Test 3 previewId returned', Boolean(previewId));

// apply_decision safety contract (before any successful apply)
const safetyVersion = state!.simulationVersion;
const noPreviewApply = await tools.apply_decision({ decision_id: reduceScope!.id });
assert(
  'Safety apply without preview_id rejected',
  noPreviewApply.success === false && noPreviewApply.code === 'INVALID_INPUT',
  noPreviewApply.success ? 'unexpected success' : noPreviewApply.code,
);
assert('Safety no mutation without preview_id', state!.simulationVersion === safetyVersion);

const invalidPreviewApply = await tools.apply_decision({
  decision_id: reduceScope!.id,
  preview_id: 'prev_nonexistent_0',
});
assert(
  'Safety invalid preview_id rejected',
  invalidPreviewApply.success === false && invalidPreviewApply.code === 'PREVIEW_NOT_FOUND',
  invalidPreviewApply.success ? 'unexpected success' : invalidPreviewApply.code,
);
assert('Safety no mutation for invalid preview_id', state!.simulationVersion === safetyVersion);

const wrongDecisionApply = await tools.apply_decision({
  decision_id: addMember!.id,
  preview_id: previewId!,
});
assert(
  'Safety preview for wrong decision rejected',
  wrongDecisionApply.success === false && wrongDecisionApply.code === 'PREVIEW_MISMATCH',
  wrongDecisionApply.success ? 'unexpected success' : wrongDecisionApply.code,
);
assert('Safety no mutation for preview mismatch', state!.simulationVersion === safetyVersion);

// Test 4
const t4 = await tools.compare_scenario_branch({
  decision_id: reduceScope!.id,
  versus_decision_id: addMember!.id,
});
assert('Test 4 compare_scenario_branch', t4.success === true);
assert('Test 4 no mutation', state!.simulationVersion === versionBeforePreview);
assert('Test 4 recommendation signal', t4.success && Boolean(t4.data.recommendation));

// Test 5
const t5 = await tools.apply_decision({
  decision_id: reduceScope!.id,
  preview_id: previewId,
});
assert('Test 5 apply_decision', t5.success === true);
assert('Test 5 simulation changed', state!.simulationVersion > versionBeforePreview);

// Test 6
const vBeforeDay = state!.simulationVersion;
const t6 = await tools.advance_day({});
assert('Test 6 advance_day', t6.success === true);
assert('Test 6 day advanced', state!.simulationVersion > vBeforeDay);

// Stale preview safety
const fresh = startSimulation(createAgentDemoScenario());
state = fresh;
const moveDeadline = (await tools.get_available_decisions({})).success
  ? (await tools.get_available_decisions({})).data.decisions.find(
      (d: { kind: string }) => d.kind === 'move_deadline',
    )
  : null;
const stalePreview = await tools.preview_decision({ decision_id: moveDeadline!.id });
const staleId = stalePreview.success ? stalePreview.data.previewId : null;
const staleVersion = state!.simulationVersion;
await tools.advance_day({});
const staleApply = await tools.apply_decision({
  decision_id: moveDeadline!.id,
  preview_id: staleId,
});
assert(
  'Stale preview rejected',
  staleApply.success === false && staleApply.code === 'PREVIEW_STALE',
  staleApply.success ? 'unexpected success' : staleApply.code,
);
assert('State version changed after advance', state!.simulationVersion > staleVersion);

console.log('\nAll programmatic checks completed.');
