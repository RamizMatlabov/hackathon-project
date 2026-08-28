import type { WebMCPCapabilities, WebMCPRegistrationInfo } from './types';
import { WEBMCP_BROWSER_REQUIREMENT } from './constants';
import { EXPECTED_WEBMCP_TOOL_NAMES } from './tools';

function hasModelContextObject(): boolean {
  return (
    typeof document !== 'undefined' &&
    'modelContext' in document &&
    document.modelContext != null &&
    typeof document.modelContext === 'object'
  );
}

function hasCallable(
  target: object | null | undefined,
  method: string,
): boolean {
  if (!target) return false;
  const value = Reflect.get(target, method);
  return typeof value === 'function';
}

/** Feature-detect WebMCP API surface. Does not register tools or assume browser UA. */
export function detectWebMCPCapabilities(): WebMCPCapabilities {
  const modelContextAvailable = hasModelContextObject();
  const modelContext = modelContextAvailable ? document.modelContext! : null;

  return {
    modelContext: modelContextAvailable ? 'available' : 'unavailable',
    registerTool: hasCallable(modelContext, 'registerTool') ? 'available' : 'unavailable',
    getTools: hasCallable(modelContext, 'getTools') ? 'available' : 'unavailable',
  };
}

export function isWebMCPSupported(capabilities = detectWebMCPCapabilities()): boolean {
  return (
    capabilities.modelContext === 'available' &&
    capabilities.registerTool === 'available'
  );
}

export function canVerifyRegistration(
  capabilities = detectWebMCPCapabilities(),
): boolean {
  return isWebMCPSupported(capabilities) && capabilities.getTools === 'available';
}

export function createInitialRegistrationInfo(): WebMCPRegistrationInfo {
  const capabilities = detectWebMCPCapabilities();
  const supported = isWebMCPSupported(capabilities);

  return {
    status: supported ? 'available' : 'unsupported',
    capabilities,
    expectedToolCount: EXPECTED_WEBMCP_TOOL_NAMES.length,
    registeredToolCount: 0,
    registeredToolNames: [],
    failedTools: [],
    verifiedViaGetTools: false,
    browserRequirement: WEBMCP_BROWSER_REQUIREMENT,
    error: supported
      ? undefined
      : 'This browser does not expose document.modelContext.',
  };
}

export async function queryRegisteredToolNames(): Promise<string[]> {
  if (!canVerifyRegistration()) return [];

  try {
    const tools = await document.modelContext!.getTools();
    return tools.map((tool) => tool.name);
  } catch {
    return [];
  }
}
