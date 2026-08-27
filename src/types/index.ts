export type RiskTolerance = 'low' | 'medium' | 'high';

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'needs_restructure' | 'completed';

export type ResourceType = 'budget' | 'time' | 'tools' | 'infrastructure' | 'other';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DecisionKind =
  | 'reduce_scope'
  | 'add_team_member'
  | 'move_deadline'
  | 'remove_task'
  | 'increase_resources';

export type SimulationStatus =
  | 'on_track'
  | 'at_risk'
  | 'critical'
  | 'completed'
  | 'failed';

export type AppView = 'dashboard' | 'builder' | 'simulation';

export interface Goal {
  id: string;
  title: string;
  description: string;
  successCriteria: string[];
}

export interface Constraint {
  id: string;
  label: string;
  description: string;
  hard: boolean;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  amount: number;
  unit: string;
  remaining: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  capacity: number;
  skills: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  estimatedDays: number;
  dayStart: number;
  dayEnd: number;
  priority: 'low' | 'medium' | 'high';
}

export interface Risk {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  probability: number;
  mitigation: string;
}

export interface DecisionEffect {
  summary: string;
  successProbabilityDelta: number;
  riskSeverityShift?: number;
  statusHint?: SimulationStatus;
}

export interface Decision {
  id: string;
  kind: DecisionKind;
  title: string;
  description: string;
  available: boolean;
  /** Payload varies by decision kind */
  payload?: Record<string, unknown>;
}

export interface SimulationEvent {
  id: string;
  timestamp: number;
  day: number;
  title: string;
  detail: string;
  category: 'system' | 'decision' | 'risk' | 'resource' | 'team' | 'task';
}

export interface Scenario {
  id: string;
  name: string;
  goal: Goal;
  deadlineDays: number;
  resources: Resource[];
  team: TeamMember[];
  constraints: Constraint[];
  riskTolerance: RiskTolerance;
  createdAt: number;
  lastOpenedAt: number;
}

export interface SimulationState {
  scenarioId: string;
  scenarioName: string;
  goal: Goal;
  day: number;
  deadlineDays: number;
  status: SimulationStatus;
  successProbability: number;
  resources: Resource[];
  team: TeamMember[];
  constraints: Constraint[];
  tasks: Task[];
  risks: Risk[];
  availableDecisions: Decision[];
  events: SimulationEvent[];
  riskTolerance: RiskTolerance;
  lastDecisionId: string | null;
  lastConsequence: string | null;
}

export interface ScenarioDraft {
  name: string;
  goalTitle: string;
  goalDescription: string;
  successCriteria: string;
  deadlineDays: number;
  resourcesText: string;
  teamText: string;
  constraintsText: string;
  riskTolerance: RiskTolerance;
}
