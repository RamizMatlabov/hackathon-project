import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { SimulationState } from '../types';
import { deriveAgentUISyncIntent } from '../webmcp/agentUISync';
import { createInitialRegistrationInfo, isWebMCPSupported } from '../webmcp/capabilities';
import { registerLifeSimTools } from '../webmcp/register';
import { runWebMCPSelfTest } from '../webmcp/selfTest';
import type {
  AgentUISyncIntent,
  SimulationBridge,
  WebMCPDebugEntry,
  WebMCPRegistrationInfo,
  WebMCPSelfTestResult,
  WorkspaceUIState,
} from '../webmcp/types';

const MAX_DEBUG_ENTRIES = 40;

const INITIAL_WORKSPACE_UI: WorkspaceUIState = {
  selectedDecisionId: null,
  branchDecisionId: null,
  branchVersusDecisionId: null,
  mutationHighlight: null,
};

function applyAgentIntent(
  prev: WorkspaceUIState,
  intent: Omit<AgentUISyncIntent, 'seq'>,
): WorkspaceUIState {
  return {
    selectedDecisionId:
      'selectedDecisionId' in intent
        ? (intent.selectedDecisionId ?? null)
        : prev.selectedDecisionId,
    branchDecisionId:
      'branchDecisionId' in intent
        ? (intent.branchDecisionId ?? null)
        : prev.branchDecisionId,
    branchVersusDecisionId:
      'branchVersusDecisionId' in intent
        ? (intent.branchVersusDecisionId ?? null)
        : prev.branchVersusDecisionId,
    mutationHighlight: intent.mutationHighlight ?? null,
  };
}

export function useWebMCP(
  simulation: SimulationState | null,
  setSimulation: Dispatch<SetStateAction<SimulationState | null>>,
) {
  const simulationRef = useRef(simulation);
  const [registration, setRegistration] = useState<WebMCPRegistrationInfo>(
    createInitialRegistrationInfo,
  );
  const [debugLog, setDebugLog] = useState<WebMCPDebugEntry[]>([]);
  const [workspaceUI, setWorkspaceUI] = useState<WorkspaceUIState>(INITIAL_WORKSPACE_UI);
  const [selfTest, setSelfTest] = useState<WebMCPSelfTestResult | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const highlightTimerRef = useRef<number | null>(null);

  simulationRef.current = simulation;

  useEffect(() => {
    setWorkspaceUI(INITIAL_WORKSPACE_UI);
  }, [simulation?.scenarioId]);

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

  const applyAgentUISync = useCallback((intent: Omit<AgentUISyncIntent, 'seq'>) => {
    setWorkspaceUI((prev) => applyAgentIntent(prev, intent));
    if (intent.mutationHighlight) {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setWorkspaceUI((prev) => ({ ...prev, mutationHighlight: null }));
        highlightTimerRef.current = null;
      }, 1800);
    }
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    let unregister: (() => void) | undefined;

    registerLifeSimTools(bridgeRef.current, {
      signal: abort.signal,
      onStatus: setRegistration,
      onDebug: (entry) => {
        setDebugLog((prev) => [entry, ...prev].slice(0, MAX_DEBUG_ENTRIES));
        const intent = deriveAgentUISyncIntent(entry);
        if (intent) applyAgentUISync(intent);
      },
    }).then((cleanup) => {
      unregister = cleanup;
    });

    return () => {
      abort.abort();
      unregister?.();
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, [applyAgentUISync, setSimulation]);

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

  const setSelectedDecisionId = useCallback((decisionId: string | null) => {
    setWorkspaceUI((prev) => ({ ...prev, selectedDecisionId: decisionId }));
  }, []);

  const setBranchCompare = useCallback(
    (branchDecisionId: string | null, branchVersusDecisionId: string | null = null) => {
      setWorkspaceUI((prev) => ({
        ...prev,
        branchDecisionId,
        branchVersusDecisionId,
      }));
    },
    [],
  );

  const clearBranchCompare = useCallback(() => {
    setWorkspaceUI((prev) => ({
      ...prev,
      branchDecisionId: null,
      branchVersusDecisionId: null,
    }));
  }, []);

  const resetWorkspaceUI = useCallback(() => {
    setWorkspaceUI(INITIAL_WORKSPACE_UI);
  }, []);

  return {
    registration,
    debugLog,
    workspaceUI,
    setSelectedDecisionId,
    setBranchCompare,
    clearBranchCompare,
    resetWorkspaceUI,
    selfTest,
    selfTestRunning,
    runSelfTest,
    clearDebugLog: () => setDebugLog([]),
    isSupported: isWebMCPSupported(),
  };
}
