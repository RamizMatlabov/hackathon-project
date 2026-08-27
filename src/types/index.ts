export type RiskTolerance = 'low' | 'medium' | 'high';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'needs_restructure'
  | 'completed';

export type ResourceType = 'budget' | 'time' | 'tools' | 'infrastructure' | 'other';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DecisionKind =
  | 'reduce_scope'
  | 'add_team_member'
  | 'move_deadline'
  | 'remove_task'
  | 'increase_resources';

export type DecisionCategory =
  | 'scope'
  | 'team'
  | 'schedule'
  | 'tasks'
  | 'resources';

export type ImpactLevel = 'low' | 'medium' | 'high';

export type SimulationStatus =
  | 'on_track'
  | 'at_risk'
  | 'critical'
  | 'completed'
  | 'failed';

export type AppView = 'dashboard' | 'builder' | 'simulation';

export type MetricKey =
  | 'successProbability'
  | 'risk'
  | 'timePressure'
  | 'resourcePressure'
  | 'teamCapacity'
  | 'openTasks'
  | 'remainingDays'
  | 'teamSize';

export type EventType =
  | 'system'
  | 'decision_applied'
  | 'risk_change'
  | 'resource_change'
  | 'team_change'
  | 'task_change'
  | 'metric_change'
  | 'day_advanced';

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

/** Declarative effect descriptor shown in the UI / used by tooling. */
export interface DecisionEffectSpec {
  target: MetricKey | 'tasks' | 'deadline' | 'team' | 'resources' | 'risks';
  description: string;
  direction: 'increase' | 'decrease' | 'mixed';
}

export interface Decision {
  id: string;
  kind: DecisionKind;
  title: string;
  description: string;
  category: DecisionCategory;
  available: boolean;
  effects: DecisionEffectSpec[];
  possibleRisks: string[];
  estimatedImpact: ImpactLevel;
  /** Payload varies by decision kind */
  payload?: Record<string, unknown>;
}

export interface SimulationMetrics {
  successProbability: number;
  risk: number;
  timePressure: number;
  resourcePressure: number;
  teamCapacity: number;
  openTasks: number;
  remainingDays: number;
  teamSize: number;
}

export interface MetricChange {
  metric: MetricKey;
  label: string;
  before: number;
  after: number;
  unit?: '%' | 'count' | 'days';
}

export type ImpactStepKind = 'decision' | 'direct' | 'secondary' | 'outcome';

export interface ImpactStep {
  kind: ImpactStepKind;
  label: string;
  detail?: string;
}

export interface SimulationEvent {
  id: string;
  timestamp: number;
  day: number;
  eventType: EventType;
  title: string;
  description: string;
  impact: string;
  relatedDecisionId: string | null;
  relatedDecisionTitle: string | null;
  /** @deprecated Prefer eventType; kept for existing CSS hooks */
  category: 'system' | 'decision' | 'risk' | 'resource' | 'team' | 'task';
}

export interface DecisionResult {
  decisionId: string;
  decisionTitle: string;
  decisionDescription: string;
  category: DecisionCategory;
  before: SimulationMetrics;
  after: SimulationMetrics;
  changes: MetricChange[];
  consequences: string[];
  events: SimulationEvent[];
  impactChain: ImpactStep[];
  estimatedImpact: ImpactLevel;
  possibleRisks: string[];
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
  remainingDays: number;
  status: SimulationStatus;
  successProbability: number;
  metrics: SimulationMetrics;
  resources: Resource[];
  team: TeamMember[];
  constraints: Constraint[];
  tasks: Task[];
  risks: Risk[];
  availableDecisions: Decision[];
  decisionsHistory: string[];
  events: SimulationEvent[];
  riskTolerance: RiskTolerance;
  lastDecisionId: string | null;
  lastConsequence: string | null;
  lastResult: DecisionResult | null;
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
