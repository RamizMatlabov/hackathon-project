import type { JsonSchemaForInference } from '@mcp-b/webmcp-types';
import type { Resource, SimulationState, Task, TeamMember } from '../types';
import {
  addResource,
  addTask,
  addTeamMember,
  advanceDay,
  applyDecision,
  changeDeadline,
  compareScenarioBranch,
  getAvailableDecisions,
  getSimulationState,
  previewDecision,
  removeTask,
  simulate,
} from '../simulation/actions';
import { appendAgentActionEvent } from './agentEvents';
import { getActiveSimulation, isToolFailure, requireNumber, requireString, toolErr, toolOk } from './results';
import {
  serializeCompareResult,
  serializeDecisionResult,
  serializeDecisionSummary,
  serializeSimulatePreview,
  serializeSimulationState,
} from './serialize';
import type {
  SimulationBridge,
  WebMCPDebugEntry,
  WebMCPToolCategory,
  WebMCPToolFailure,
  WebMCPToolName,
  WebMCPToolResult,
} from './types';

export const EXPECTED_WEBMCP_TOOL_NAMES = [
  'get_simulation_state',
  'get_available_decisions',
  'preview_decision',
  'compare_scenario_branch',
  'simulate',
  'apply_decision',
  'advance_day',
  'change_deadline',
  'add_task',
  'remove_task',
  'add_resource',
  'add_team_member',
] as const satisfies readonly WebMCPToolName[];

type ToolHandler = (input: Record<string, unknown>) => Promise<WebMCPToolResult> | WebMCPToolResult;

interface LifeSimToolDefinition {
  name: WebMCPToolName;
  title: string;
  description: string;
  category: WebMCPToolCategory;
  readOnly: boolean;
  inputSchema: JsonSchemaForInference;
  handler: ToolHandler;
}

function asRecord(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return {};
}

function requireTaskStatus(
  value: unknown,
): Task['status'] | WebMCPToolFailure {
  const allowed: Task['status'][] = [
    'pending',
    'in_progress',
    'blocked',
    'needs_restructure',
    'completed',
  ];
  if (typeof value !== 'string' || !allowed.includes(value as Task['status'])) {
    return toolErr(
      'INVALID_INPUT',
      `status must be one of: ${allowed.join(', ')}.`,
    );
  }
  return value as Task['status'];
}

function requirePriority(
  value: unknown,
): Task['priority'] | WebMCPToolFailure {
  const allowed: Task['priority'][] = ['low', 'medium', 'high'];
  if (typeof value !== 'string' || !allowed.includes(value as Task['priority'])) {
    return toolErr('INVALID_INPUT', `priority must be one of: ${allowed.join(', ')}.`);
  }
  return value as Task['priority'];
}

function requireResourceType(
  value: unknown,
): Resource['type'] | WebMCPToolFailure {
  const allowed: Resource['type'][] = [
    'budget',
    'time',
    'tools',
    'infrastructure',
    'other',
  ];
  if (typeof value !== 'string' || !allowed.includes(value as Resource['type'])) {
    return toolErr(
      'INVALID_INPUT',
      `type must be one of: ${allowed.join(', ')}.`,
    );
  }
  return value as Resource['type'];
}

function commitMutation(
  bridge: SimulationBridge,
  toolName: WebMCPToolName,
  detail: string,
  mutate: (state: SimulationState) => SimulationState,
): WebMCPToolResult {
  const current = bridge.getState();
  if (!current) {
    return toolErr('NO_SIMULATION', 'No active simulation. Open or start a scenario in LifeSim first.');
  }

  const next = mutate(current);
  const withAgentEvent = appendAgentActionEvent(next, toolName, detail);
  bridge.setState(() => withAgentEvent);
  return toolOk(serializeSimulationState(withAgentEvent));
}

export function createLifeSimToolDefinitions(
  bridge: SimulationBridge,
): LifeSimToolDefinition[] {
  return [
    {
      name: 'get_simulation_state',
      title: 'Get simulation state',
      category: 'observe',
      readOnly: true,
      description:
        'Returns the current LifeSim scenario snapshot: deadline, day, tasks, resources, team, risks, metrics, narrative, and recent events. Call this first when the live simulation state is unknown or may have changed.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: () => {
        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;
        return toolOk(serializeSimulationState(getSimulationState(state)));
      },
    },
    {
      name: 'get_available_decisions',
      title: 'List available decisions',
      category: 'observe',
      readOnly: true,
      description:
        'Lists structured decision options the simulation currently allows (scope, schedule, team, resources). Use before previewing or applying a decision.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: () => {
        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;
        return toolOk({
          decisions: getAvailableDecisions(state).map(serializeDecisionSummary),
        });
      },
    },
    {
      name: 'preview_decision',
      title: 'Preview decision impact',
      category: 'analyze',
      readOnly: true,
      description:
        'Runs a dry-run of a decision without mutating the live scenario. Returns direct, secondary, and emergent consequences plus before/after metrics. Prefer this for "what if" questions.',
      inputSchema: {
        type: 'object',
        properties: {
          decision_id: {
            type: 'string',
            description: 'ID from get_available_decisions.',
          },
        },
        required: ['decision_id'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;

        const decisionId = requireString(input.decision_id, 'decision_id');
        if (isToolFailure(decisionId)) return decisionId;

        const decision = state.availableDecisions.find((d) => d.id === decisionId);
        if (!decision) {
          return toolErr('NOT_FOUND', `No decision with id "${decisionId}".`);
        }
        if (!decision.available) {
          return toolErr(
            'DECISION_UNAVAILABLE',
            `Decision "${decision.title}" is not currently available.`,
          );
        }

        const preview = previewDecision(state, decisionId);
        if (!preview) {
          return toolErr('UNAVAILABLE', 'Preview could not be computed for this decision.');
        }

        return toolOk(serializeDecisionResult(preview));
      },
    },
    {
      name: 'compare_scenario_branch',
      title: 'Compare scenario branches',
      category: 'analyze',
      readOnly: true,
      description:
        'Compares the current plan (scenario A) with an alternate branch produced by previewing a decision (scenario B). Use to contrast outcomes before committing.',
      inputSchema: {
        type: 'object',
        properties: {
          decision_id: {
            type: 'string',
            description:
              'Decision to branch from. Omit or pass null to compare against the unchanged current plan.',
          },
        },
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;

        const rawId = input.decision_id;
        const decisionId =
          rawId == null || rawId === ''
            ? null
            : requireString(rawId, 'decision_id');
        if (isToolFailure(decisionId)) return decisionId;

        if (decisionId) {
          const decision = state.availableDecisions.find((d) => d.id === decisionId);
          if (!decision) {
            return toolErr('NOT_FOUND', `No decision with id "${decisionId}".`);
          }
        }

        return toolOk(
          serializeCompareResult(compareScenarioBranch(state, decisionId)),
        );
      },
    },
    {
      name: 'simulate',
      title: 'Recalculate simulation preview',
      category: 'analyze',
      readOnly: true,
      description:
        'Recomputes metrics and narrative on a cloned copy of the scenario without changing live state. Use to refresh projections after observing state.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: () => {
        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;

        const projected = simulate(state);
        return toolOk(serializeSimulatePreview(projected));
      },
    },
    {
      name: 'apply_decision',
      title: 'Apply decision',
      category: 'act',
      readOnly: false,
      description:
        'Commits a decision to the live simulation. Mutates tasks, metrics, and the activity log. Use only after preview_decision when the user intends to commit.',
      inputSchema: {
        type: 'object',
        properties: {
          decision_id: {
            type: 'string',
            description: 'ID from get_available_decisions.',
          },
        },
        required: ['decision_id'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;

        const decisionId = requireString(input.decision_id, 'decision_id');
        if (isToolFailure(decisionId)) return decisionId;

        const decision = state.availableDecisions.find((d) => d.id === decisionId);
        if (!decision) {
          return toolErr('NOT_FOUND', `No decision with id "${decisionId}".`);
        }
        if (!decision.available) {
          return toolErr(
            'DECISION_UNAVAILABLE',
            `Decision "${decision.title}" is not currently available.`,
          );
        }

        return commitMutation(
          bridge,
          'apply_decision',
          `Applied decision "${decision.title}".`,
          (current) => applyDecision(current, decisionId),
        );
      },
    },
    {
      name: 'advance_day',
      title: 'Advance simulation day',
      category: 'act',
      readOnly: false,
      description:
        'Moves the simulation forward one day, progressing tasks and evolving risks. Mutates live state and logs the day advance.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: () =>
        commitMutation(
          bridge,
          'advance_day',
          'Advanced the simulation by one day.',
          (current) => advanceDay(current),
        ),
    },
    {
      name: 'change_deadline',
      title: 'Change deadline',
      category: 'act',
      readOnly: false,
      description:
        'Sets the scenario deadline in total days. Mutates live state. For "what if" deadline questions, preview a move_deadline decision instead of calling this tool.',
      inputSchema: {
        type: 'object',
        properties: {
          days: {
            type: 'integer',
            minimum: 1,
            description: 'New total deadline length in days (minimum 1).',
          },
        },
        required: ['days'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const days = requireNumber(input.days, 'days', { min: 1, integer: true });
        if (isToolFailure(days)) return days;

        return commitMutation(
          bridge,
          'change_deadline',
          `Deadline changed to ${days} days.`,
          (current) => changeDeadline(current, days),
        );
      },
    },
    {
      name: 'add_task',
      title: 'Add task',
      category: 'act',
      readOnly: false,
      description:
        'Adds a task to the live scenario. Mutates tasks, metrics, and the activity log.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'blocked', 'needs_restructure', 'completed'],
          },
          assignee_id: { type: ['string', 'null'] },
          estimated_days: { type: 'number', minimum: 0 },
          day_start: { type: 'integer', minimum: 0 },
          day_end: { type: 'integer', minimum: 0 },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['title', 'description', 'estimated_days', 'day_start', 'day_end', 'priority'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const title = requireString(input.title, 'title');
        if (isToolFailure(title)) return title;
        const description = requireString(input.description, 'description');
        if (isToolFailure(description)) return description;
        const estimatedDays = requireNumber(input.estimated_days, 'estimated_days', {
          min: 0,
        });
        if (isToolFailure(estimatedDays)) return estimatedDays;
        const dayStart = requireNumber(input.day_start, 'day_start', {
          min: 0,
          integer: true,
        });
        if (isToolFailure(dayStart)) return dayStart;
        const dayEnd = requireNumber(input.day_end, 'day_end', {
          min: 0,
          integer: true,
        });
        if (isToolFailure(dayEnd)) return dayEnd;
        const priority = requirePriority(input.priority);
        if (isToolFailure(priority)) return priority;
        const status = input.status == null ? 'pending' : requireTaskStatus(input.status);
        if (isToolFailure(status)) return status;

        const assigneeId =
          input.assignee_id == null
            ? null
            : requireString(input.assignee_id, 'assignee_id');
        if (isToolFailure(assigneeId)) return assigneeId;

        const taskInput: Omit<Task, 'id'> = {
          title,
          description,
          status,
          assigneeId,
          estimatedDays,
          dayStart,
          dayEnd,
          priority,
        };

        return commitMutation(
          bridge,
          'add_task',
          `Added task "${title}".`,
          (current) => addTask(current, taskInput),
        );
      },
    },
    {
      name: 'remove_task',
      title: 'Remove task',
      category: 'act',
      readOnly: false,
      description: 'Removes a task by ID from the live scenario.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
        },
        required: ['task_id'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const taskId = requireString(input.task_id, 'task_id');
        if (isToolFailure(taskId)) return taskId;

        const state = getActiveSimulation(bridge);
        if (isToolFailure(state)) return state;

        const task = state.tasks.find((t) => t.id === taskId);
        if (!task) {
          return toolErr('NOT_FOUND', `No task with id "${taskId}".`);
        }

        return commitMutation(
          bridge,
          'remove_task',
          `Removed task "${task.title}".`,
          (current) => removeTask(current, taskId),
        );
      },
    },
    {
      name: 'add_resource',
      title: 'Add resource',
      category: 'act',
      readOnly: false,
      description: 'Adds a resource pool (budget, time, tools, etc.) to the live scenario.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['budget', 'time', 'tools', 'infrastructure', 'other'],
          },
          amount: { type: 'number', minimum: 0 },
          unit: { type: 'string' },
          remaining: { type: 'number', minimum: 0 },
        },
        required: ['name', 'type', 'amount', 'unit', 'remaining'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const name = requireString(input.name, 'name');
        if (isToolFailure(name)) return name;
        const type = requireResourceType(input.type);
        if (isToolFailure(type)) return type;
        const amount = requireNumber(input.amount, 'amount', { min: 0 });
        if (isToolFailure(amount)) return amount;
        const unit = requireString(input.unit, 'unit');
        if (isToolFailure(unit)) return unit;
        const remaining = requireNumber(input.remaining, 'remaining', { min: 0 });
        if (isToolFailure(remaining)) return remaining;

        const resourceInput: Omit<Resource, 'id'> = {
          name,
          type,
          amount,
          unit,
          remaining,
        };

        return commitMutation(
          bridge,
          'add_resource',
          `Added resource "${name}".`,
          (current) => addResource(current, resourceInput),
        );
      },
    },
    {
      name: 'add_team_member',
      title: 'Add team member',
      category: 'act',
      readOnly: false,
      description: 'Adds a team member with role, capacity, and skills to the live scenario.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          role: { type: 'string' },
          capacity: { type: 'number', minimum: 0, maximum: 100 },
          skills: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['name', 'role', 'capacity', 'skills'],
        additionalProperties: false,
      } as const satisfies JsonSchemaForInference,
      handler: (input) => {
        const name = requireString(input.name, 'name');
        if (isToolFailure(name)) return name;
        const role = requireString(input.role, 'role');
        if (isToolFailure(role)) return role;
        const capacity = requireNumber(input.capacity, 'capacity', { min: 0 });
        if (isToolFailure(capacity)) return capacity;

        if (!Array.isArray(input.skills)) {
          return toolErr('INVALID_INPUT', '"skills" must be an array of strings.');
        }
        const skills = input.skills.map((skill) =>
          typeof skill === 'string' ? skill.trim() : '',
        );
        if (skills.some((skill) => skill.length === 0)) {
          return toolErr('INVALID_INPUT', '"skills" must contain non-empty strings.');
        }

        const memberInput: Omit<TeamMember, 'id'> = {
          name,
          role,
          capacity,
          skills,
        };

        return commitMutation(
          bridge,
          'add_team_member',
          `Added team member "${name}" (${role}).`,
          (current) => addTeamMember(current, memberInput),
        );
      },
    },
  ];
}

export function wrapToolHandler(
  definition: LifeSimToolDefinition,
  onDebug?: (entry: WebMCPDebugEntry) => void,
): (input: unknown) => Promise<WebMCPToolResult> {
  return async (input) => {
    const started = performance.now();
    const args = asRecord(input);

    try {
      const result = await definition.handler(args);
      onDebug?.({
        id: `${definition.name}_${started}`,
        timestamp: Date.now(),
        tool: definition.name,
        category: definition.category,
        args,
        result,
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    } catch (error) {
      const result = toolErr(
        'UNAVAILABLE',
        error instanceof Error ? error.message : 'Tool execution failed.',
      );
      onDebug?.({
        id: `${definition.name}_${started}`,
        timestamp: Date.now(),
        tool: definition.name,
        category: definition.category,
        args,
        result,
        durationMs: Math.round(performance.now() - started),
      });
      return result;
    }
  };
}

export type { LifeSimToolDefinition };
