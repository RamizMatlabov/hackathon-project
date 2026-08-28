import {
  canVerifyRegistration,
  detectWebMCPCapabilities,
  isWebMCPSupported,
  queryRegisteredToolNames,
} from './capabilities';
import {
  getWebMCPRegistrationInfo,
  registerLifeSimTools,
} from './register';
import { createLifeSimToolDefinitions, EXPECTED_WEBMCP_TOOL_NAMES } from './tools';
import type { SimulationBridge, WebMCPSelfTestResult, WebMCPSelfTestStep } from './types';

const NO_OP_BRIDGE: SimulationBridge = {
  getState: () => null,
  setState: () => undefined,
};

function step(
  id: string,
  label: string,
  passed: boolean,
  detail?: string,
): WebMCPSelfTestStep {
  return { id, label, passed, detail };
}

export async function runWebMCPSelfTest(
  bridge: SimulationBridge = NO_OP_BRIDGE,
): Promise<WebMCPSelfTestResult> {
  const steps: WebMCPSelfTestStep[] = [];
  const capabilities = detectWebMCPCapabilities();
  const supported = isWebMCPSupported(capabilities);

  steps.push(
    step(
      'api',
      'API detected',
      capabilities.modelContext === 'available',
      `document.modelContext: ${capabilities.modelContext}`,
    ),
  );

  steps.push(
    step(
      'register_tool',
      'registerTool detected',
      capabilities.registerTool === 'available',
      `registerTool: ${capabilities.registerTool}`,
    ),
  );

  const definitions = createLifeSimToolDefinitions(bridge);
  steps.push(
    step(
      'definitions',
      `${definitions.length} tool definitions present`,
      definitions.length === EXPECTED_WEBMCP_TOOL_NAMES.length,
      `expected ${EXPECTED_WEBMCP_TOOL_NAMES.length}, found ${definitions.length}`,
    ),
  );

  if (!supported) {
    for (const name of EXPECTED_WEBMCP_TOOL_NAMES) {
      steps.push(
        step(
          `tool:${name}`,
          name,
          false,
          'document.modelContext unavailable',
        ),
      );
    }

    return {
      ranAt: Date.now(),
      supported: false,
      steps,
      summary: 'document.modelContext unavailable',
    };
  }

  await registerLifeSimTools(bridge, { force: true });

  const registration = getWebMCPRegistrationInfo();
  const discovered = canVerifyRegistration()
    ? new Set(await queryRegisteredToolNames())
    : new Set(registration.registeredToolNames);

  for (const name of EXPECTED_WEBMCP_TOOL_NAMES) {
    const passed = discovered.has(name);
    const failure = registration.failedTools.find((tool) => tool.name === name);
    steps.push(
      step(
        `tool:${name}`,
        name,
        passed,
        passed ? undefined : failure?.error ?? 'Not registered',
      ),
    );
  }

  const readyCount = steps.filter(
    (item) => item.id.startsWith('tool:') && item.passed,
  ).length;

  return {
    ranAt: Date.now(),
    supported: true,
    steps,
    summary:
      readyCount === EXPECTED_WEBMCP_TOOL_NAMES.length
        ? `${readyCount} / ${EXPECTED_WEBMCP_TOOL_NAMES.length} tools ready`
        : `${readyCount} / ${EXPECTED_WEBMCP_TOOL_NAMES.length} tools ready`,
  };
}
