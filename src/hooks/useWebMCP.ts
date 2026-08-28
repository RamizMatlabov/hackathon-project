import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { SimulationState } from '../types';
import { createInitialRegistrationInfo, isWebMCPSupported } from '../webmcp/capabilities';
import { registerLifeSimTools } from '../webmcp/register';
import { runWebMCPSelfTest } from '../webmcp/selfTest';
import type {
  SimulationBridge,
  WebMCPDebugEntry,
  WebMCPRegistrationInfo,
  WebMCPSelfTestResult,
} from '../webmcp/types';

const MAX_DEBUG_ENTRIES = 40;

export function useWebMCP(
  simulation: SimulationState | null,
  setSimulation: Dispatch<SetStateAction<SimulationState | null>>,
) {
  const simulationRef = useRef(simulation);
  const [registration, setRegistration] = useState<WebMCPRegistrationInfo>(
    createInitialRegistrationInfo,
  );
  const [debugLog, setDebugLog] = useState<WebMCPDebugEntry[]>([]);
  const [selfTest, setSelfTest] = useState<WebMCPSelfTestResult | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);

  simulationRef.current = simulation;

  const bridgeRef = useRef<SimulationBridge>({
    getState: () => simulationRef.current,
    setState: (updater) => {
      setSimulation((prev) => updater(prev));
    },
  });

  bridgeRef.current.getState = () => simulationRef.current;
  bridgeRef.current.setState = (updater) => {
    setSimulation((prev) => updater(prev));
  };

  useEffect(() => {
    const abort = new AbortController();
    let unregister: (() => void) | undefined;

    registerLifeSimTools(bridgeRef.current, {
      signal: abort.signal,
      onStatus: setRegistration,
      onDebug: (entry) => {
        setDebugLog((prev) => [entry, ...prev].slice(0, MAX_DEBUG_ENTRIES));
      },
    }).then((cleanup) => {
      unregister = cleanup;
    });

    return () => {
      abort.abort();
      unregister?.();
    };
  }, [setSimulation]);

  const runSelfTest = useCallback(async () => {
    setSelfTestRunning(true);
    try {
      const result = await runWebMCPSelfTest(bridgeRef.current);
      setSelfTest(result);
      return result;
    } finally {
      setSelfTestRunning(false);
    }
  }, []);

  return {
    registration,
    debugLog,
    selfTest,
    selfTestRunning,
    runSelfTest,
    clearDebugLog: () => setDebugLog([]),
    isSupported: isWebMCPSupported(),
  };
}
