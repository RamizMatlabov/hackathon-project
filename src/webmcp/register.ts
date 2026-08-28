import type {} from '@mcp-b/webmcp-types';
import {
  canVerifyRegistration,
  createInitialRegistrationInfo,
  detectWebMCPCapabilities,
  isWebMCPSupported,
  queryRegisteredToolNames,
} from './capabilities';
import { createLifeSimToolDefinitions, EXPECTED_WEBMCP_TOOL_NAMES, wrapToolHandler } from './tools';
import type {
  SimulationBridge,
  WebMCPDebugEntry,
  WebMCPFailedTool,
  WebMCPRegistrationInfo,
} from './types';

type StatusListener = (info: WebMCPRegistrationInfo) => void;

interface RegistrationSession {
  generation: number;
  controller: AbortController;
  listeners: Set<StatusListener>;
}

let activeSession: RegistrationSession | null = null;
let latestInfo: WebMCPRegistrationInfo = createInitialRegistrationInfo();

function emit(info: WebMCPRegistrationInfo) {
  latestInfo = info;
  for (const listener of activeSession?.listeners ?? []) {
    listener(info);
  }
}

function buildInfo(
  partial: Partial<WebMCPRegistrationInfo> & Pick<WebMCPRegistrationInfo, 'status'>,
): WebMCPRegistrationInfo {
  return {
    ...createInitialRegistrationInfo(),
    ...latestInfo,
    ...partial,
    capabilities: partial.capabilities ?? detectWebMCPCapabilities(),
    expectedToolCount: EXPECTED_WEBMCP_TOOL_NAMES.length,
  };
}

function isStale(session: RegistrationSession, generation: number): boolean {
  return session.generation !== generation || session.controller.signal.aborted;
}

async function verifyRegisteredTools(
  registeredDuringRun: string[],
): Promise<{
  registeredToolNames: string[];
  failedTools: WebMCPFailedTool[];
  verifiedViaGetTools: boolean;
}> {
  const expected = [...EXPECTED_WEBMCP_TOOL_NAMES];

  if (!canVerifyRegistration()) {
    return {
      registeredToolNames: registeredDuringRun,
      failedTools: expected
        .filter((name) => !registeredDuringRun.includes(name))
        .map((name) => ({
          name,
          error: 'getTools() is unavailable; could not verify registration.',
        })),
      verifiedViaGetTools: false,
    };
  }

  const discovered = await queryRegisteredToolNames();
  const registeredToolNames = expected.filter((name) => discovered.includes(name));
  const failedTools: WebMCPFailedTool[] = expected
    .filter((name) => !registeredToolNames.includes(name))
    .map((name) => ({
      name,
      error: registeredDuringRun.includes(name)
        ? 'registerTool resolved but tool was not returned by getTools().'
        : 'Tool was not registered.',
    }));

  return {
    registeredToolNames,
    failedTools,
    verifiedViaGetTools: true,
  };
}

/** @deprecated Use detectWebMCPCapabilities / isWebMCPSupported instead. */
export function isWebMCPAvailable(): boolean {
  return isWebMCPSupported();
}

export function getWebMCPRegistrationInfo(): WebMCPRegistrationInfo {
  return latestInfo;
}

export async function registerLifeSimTools(
  bridge: SimulationBridge,
  options?: {
    signal?: AbortSignal;
    onDebug?: (entry: WebMCPDebugEntry) => void;
    onStatus?: StatusListener;
    force?: boolean;
  },
): Promise<() => void> {
  const capabilities = detectWebMCPCapabilities();

  if (!isWebMCPSupported(capabilities)) {
    const info = buildInfo({
      status: 'unsupported',
      capabilities,
      registeredToolCount: 0,
      registeredToolNames: [],
      failedTools: [],
      verifiedViaGetTools: false,
      error: 'This browser does not expose document.modelContext.',
    });
    emit(info);
    options?.onStatus?.(info);
    return () => undefined;
  }

  if (
    !options?.force &&
    latestInfo.status === 'ready' &&
    latestInfo.registeredToolCount === latestInfo.expectedToolCount
  ) {
    options?.onStatus?.(latestInfo);
    return () => undefined;
  }

  activeSession?.controller.abort();

  const controller = new AbortController();
  const externalSignal = options?.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  const session: RegistrationSession = {
    generation: (activeSession?.generation ?? 0) + 1,
    controller,
    listeners: new Set(options?.onStatus ? [options.onStatus] : []),
  };
  activeSession = session;
  const { generation } = session;

  emit(
    buildInfo({
      status: 'registering',
      capabilities,
      registeredToolCount: 0,
      registeredToolNames: [],
      failedTools: [],
      verifiedViaGetTools: false,
      error: undefined,
    }),
  );

  const definitions = createLifeSimToolDefinitions(bridge);
  const registeredDuringRun: string[] = [];
  const failedTools: WebMCPFailedTool[] = [];
  let firstError: string | undefined;

  const alreadyRegistered = canVerifyRegistration()
    ? new Set(await queryRegisteredToolNames())
    : new Set<string>();

  try {
    for (const definition of definitions) {
      if (isStale(session, generation)) {
        return () => controller.abort();
      }

      if (alreadyRegistered.has(definition.name)) {
        registeredDuringRun.push(definition.name);
        continue;
      }

      try {
        await document.modelContext!.registerTool(
          {
            name: definition.name,
            title: definition.title,
            description: definition.description,
            inputSchema: definition.inputSchema,
            annotations: {
              readOnlyHint: definition.readOnly,
            },
            execute: wrapToolHandler(definition, options?.onDebug),
          },
          { signal: controller.signal },
        );
        registeredDuringRun.push(definition.name);
        alreadyRegistered.add(definition.name);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Tool registration failed.';
        failedTools.push({ name: definition.name, error: message });
        firstError ??= message;

        if (canVerifyRegistration()) {
          const discovered = await queryRegisteredToolNames();
          if (discovered.includes(definition.name)) {
            registeredDuringRun.push(definition.name);
            alreadyRegistered.add(definition.name);
            failedTools.pop();
          }
        }
      }
    }

    if (isStale(session, generation)) {
      return () => controller.abort();
    }

    const verification = await verifyRegisteredTools(registeredDuringRun);
    const mergedFailures = [
      ...failedTools.filter(
        (failure) => !verification.registeredToolNames.includes(failure.name),
      ),
      ...verification.failedTools,
    ];
    const uniqueFailures = mergedFailures.filter(
      (failure, index, list) =>
        list.findIndex((item) => item.name === failure.name) === index,
    );

    const registeredToolCount = verification.registeredToolNames.length;
    const allReady = registeredToolCount === EXPECTED_WEBMCP_TOOL_NAMES.length;

    const info = buildInfo({
      status: allReady ? 'ready' : 'registration_error',
      capabilities,
      registeredToolCount,
      registeredToolNames: verification.registeredToolNames,
      failedTools: uniqueFailures,
      verifiedViaGetTools: verification.verifiedViaGetTools,
      error: allReady
        ? undefined
        : firstError ??
          `${registeredToolCount} / ${EXPECTED_WEBMCP_TOOL_NAMES.length} tools registered.`,
    });

    emit(info);
    return () => controller.abort();
  } catch (error) {
    if (isStale(session, generation)) {
      return () => controller.abort();
    }

    const message =
      error instanceof Error ? error.message : 'Tool registration failed.';
    const info = buildInfo({
      status: 'registration_error',
      capabilities,
      registeredToolCount: registeredDuringRun.length,
      registeredToolNames: registeredDuringRun,
      failedTools,
      verifiedViaGetTools: false,
      error: message,
    });
    emit(info);
    return () => controller.abort();
  }
}

export async function listRegisteredTools(): Promise<string[]> {
  return queryRegisteredToolNames();
}

export function subscribeWebMCPStatus(listener: StatusListener): () => void {
  listener(latestInfo);
  if (!activeSession) {
    return () => undefined;
  }
  activeSession.listeners.add(listener);
  return () => {
    activeSession?.listeners.delete(listener);
  };
}
