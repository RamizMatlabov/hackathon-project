import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { SimulationState } from '../types';
import { deriveAgentRecommendationUpdate } from '../webmcp/agentRecommendation';
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
  agentRecommendation: null,
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
    agentRecommendation: prev.agentRecommendation,
  };
}

export function useWebMCP(
  simulation: SimulationState | null,
  setSimulation: Dispatch<SetStateAction<SimulationState | null>>,
  simulationSessionKey: number,
) {
  const simulationRef = useRef(simulation);
  const [registration, setRegistration] = useState<WebMCPRegistrationInfo>(
    createInitialRegistrationInfo,
  );
  const [debugLog, setDebugLog] = useState<WebMCPDebugEntry[]>([]);
  const [playbookSince, setPlaybookSince] = useState(() => Date.now());
  const [workspaceUI, setWorkspaceUI] = useState<WorkspaceUIState>(INITIAL_WORKSPACE_UI);
  const [selfTest, setSelfTest] = useState<WebMCPSelfTestResult | null>(null);
  const [selfTestRunning, setSelfTestRunning] = useState(false);
  const highlightTimerRef = useRef<number | null>(null);
  const appliedDismissTimerRef = useRef<number | null>(null);

  simulationRef.current = simulation;

  useEffect(() => {
    if (!simulation) return;
    setPlaybookSince(Date.now());
    setWorkspaceUI(INITIAL_WORKSPACE_UI);
  }, [simulationSessionKey]);

  useEffect(() => {
    setWorkspaceUI((prev) => {
      const rec = prev.agentRecommendation;
      if (!rec || rec.status !== 'pending') return prev;
      if (simulation && simulation.simulationVersion !== rec.simulationVersion) {
        return {
          ...prev,
          agentRecommendation: { ...rec, status: 'stale' },
        };
      }
      return prev;
    });
  }, [simulation?.simulationVersion]);

  useEffect(() => {
    if (workspaceUI.agentRecommendation?.status !== 'applied') return undefined;

    if (appliedDismissTimerRef.current != null) {
      window.clearTimeout(appliedDismissTimerRef.current);
    }

    appliedDismissTimerRef.current = window.setTimeout(() => {
      setWorkspaceUI((prev) =>
        prev.agentRecommendation?.status === 'applied'
          ? { ...prev, agentRecommendation: null }
          : prev,
      );
      appliedDismissTimerRef.current = null;
    }, 4000);

    return () => {
      if (appliedDismissTimerRef.current != null) {
        window.clearTimeout(appliedDismissTimerRef.current);
        appliedDismissTimerRef.current = null;
      }
    };
  }, [workspaceUI.agentRecommendation?.status, workspaceUI.agentRecommendation?.previewId]);

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

  const startMutationHighlightTimer = useCallback(() => {
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setWorkspaceUI((prev) => ({ ...prev, mutationHighlight: null }));
      highlightTimerRef.current = null;
    }, 1800);
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
        setWorkspaceUI((prev) => {
          const recUpdate = deriveAgentRecommendationUpdate(entry, prev.agentRecommendation);
          const next = intent ? applyAgentIntent(prev, intent) : prev;
          if (recUpdate === undefined) return next;
          return { ...next, agentRecommendation: recUpdate };
        });
        if (intent?.mutationHighlight) {
          startMutationHighlightTimer();
        }
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
      if (appliedDismissTimerRef.current != null) {
        window.clearTimeout(appliedDismissTimerRef.current);
      }
    };
  }, [setSimulation, startMutationHighlightTimer]);

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

  const confirmAgentRecommendation = useCallback((decisionId: string) => {
    setWorkspaceUI((prev) => {
      const rec = prev.agentRecommendation;
      if (!rec || rec.decisionId !== decisionId || rec.status !== 'pending') return prev;
      return { ...prev, agentRecommendation: { ...rec, status: 'applied' } };
    });
  }, []);

  const dismissAgentRecommendation = useCallback(() => {
    setWorkspaceUI((prev) => ({ ...prev, agentRecommendation: null }));
  }, []);

  return {
    registration,
    debugLog,
    playbookSince,
    workspaceUI,
    setSelectedDecisionId,
    setBranchCompare,
    clearBranchCompare,
    resetWorkspaceUI,
    confirmAgentRecommendation,
    dismissAgentRecommendation,
    selfTest,
    selfTestRunning,
    runSelfTest,
    clearDebugLog: () => setDebugLog([]),
    isSupported: isWebMCPSupported(),
  };
}
