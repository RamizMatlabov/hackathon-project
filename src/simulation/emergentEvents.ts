import type { EventType, SimulationEvent, SimulationMetrics, SimulationState } from '../types';
import { clamp, stableId } from '../utils/helpers';
import { conditions } from './conditions';

const CATEGORY_MAP: Record<EventType, SimulationEvent['category']> = {
  system: 'system',
  decision_applied: 'decision',
  risk_change: 'risk',
  resource_change: 'resource',
  team_change: 'team',
  task_change: 'task',
  metric_change: 'system',
  day_advanced: 'system',
  emergent: 'system',
};

/** Deterministic event factory — ids derived from content, not randomness. */
export function generateSimulationEvent(input: {
  day: number;
  eventType: EventType;
  title: string;
  description: string;
  impact: string;
  relatedDecisionId?: string | null;
  relatedDecisionTitle?: string | null;
  seq?: number;
}): SimulationEvent {
  return {
    id: stableId('evt', input.day, input.eventType, input.title, input.seq ?? 0),
    timestamp: input.day * 1000 + (input.seq ?? 0),
    day: input.day,
    eventType: input.eventType,
    title: input.title,
    description: input.description,
    impact: input.impact,
    relatedDecisionId: input.relatedDecisionId ?? null,
    relatedDecisionTitle: input.relatedDecisionTitle ?? null,
    category: CATEGORY_MAP[input.eventType],
  };
}

/**
 * Deterministic emergent events from before/after world state.
 * Same inputs always yield the same events — no randomness.
 */
export function detectEmergentEvents(
  before: SimulationState,
  after: SimulationState,
  beforeMetrics: SimulationMetrics,
  afterMetrics: SimulationMetrics,
): SimulationEvent[] {
  const day = after.day;
  const events: SimulationEvent[] = [];
  let seq = 0;

  const push = (
    title: string,
    description: string,
    impact: string,
    eventType: EventType = 'emergent',
  ) => {
    events.push(
      generateSimulationEvent({
        day,
        eventType,
        title,
        description,
        impact,
        seq: seq++,
      }),
    );
  };

  const newlyCritical = after.tasks.filter((t, i) => {
    const prev = before.tasks.find((p) => p.id === t.id) ?? before.tasks[i];
    if (!prev) return t.status === 'needs_restructure' || t.priority === 'high';
    return (
      (t.status === 'needs_restructure' && prev.status !== 'needs_restructure') ||
      (t.priority === 'high' && prev.priority !== 'high' && t.status !== 'completed')
    );
  });

  if (newlyCritical.length > 0) {
    push(
      'Task became critical',
      newlyCritical.map((t) => t.title).join('; '),
      `${newlyCritical.length} task(s) elevated`,
      'task_change',
    );
  }

  if (conditions.overloadedTeam(afterMetrics) && !conditions.overloadedTeam(beforeMetrics)) {
    push(
      'Team is overloaded',
      'Available capacity fell below a sustainable threshold for open work.',
      `Team capacity ${afterMetrics.teamCapacity}%`,
    );
  }

  if (conditions.resourceShortage(afterMetrics) && !conditions.resourceShortage(beforeMetrics)) {
    push(
      'Resource shortage detected',
      'Remaining resource headroom is critically low relative to allocated pools.',
      `Resource pressure ${afterMetrics.resourcePressure}%`,
      'resource_change',
    );
  }

  if (conditions.scheduleRecovered(beforeMetrics, afterMetrics)) {
    push(
      'Schedule recovered',
      'Time pressure eased below the recovery threshold after recent actions.',
      `Time pressure ${beforeMetrics.timePressure}% → ${afterMetrics.timePressure}%`,
    );
  }

  if (conditions.riskThresholdCrossed(beforeMetrics, afterMetrics)) {
    push(
      'Risk threshold crossed',
      'Aggregate risk surpassed the 70% warning line.',
      `Risk ${beforeMetrics.risk}% → ${afterMetrics.risk}%`,
      'risk_change',
    );
  }

  if (conditions.opportunityWindow(after) && !conditions.opportunityWindow(before)) {
    push(
      'New opportunity discovered',
      'Capacity, schedule, and resources align — a window to raise ambition or de-risk further.',
      `Success ${afterMetrics.successProbability}% · Risk ${afterMetrics.risk}%`,
    );
  }

  if (
    conditions.shortDeadline(afterMetrics) &&
    conditions.lowTeamCapacity(afterMetrics) &&
    afterMetrics.timePressure >= 70
  ) {
    const already = before.events.some(
      (e) => e.title === 'High time pressure' && e.day === day,
    );
    if (!already && afterMetrics.timePressure > beforeMetrics.timePressure) {
      push(
        'High time pressure',
        'With ≤3 days left and team capacity under 70%, schedule pressure is dominant.',
        `Time pressure ${afterMetrics.timePressure}%`,
      );
    }
  }

  const unblocked = after.tasks.filter((t) => {
    const prev = before.tasks.find((p) => p.id === t.id);
    return prev?.status === 'blocked' && t.status !== 'blocked';
  });
  if (unblocked.length > 0) {
    push(
      'Blocked work resumed',
      unblocked.map((t) => t.title).join('; '),
      `${unblocked.length} task(s) unblocked`,
      'task_change',
    );
  }

  return events;
}

/** Evolve risk probabilities/severities deterministically from pressures. */
export function evolveRisks(
  state: SimulationState,
  metrics: SimulationMetrics,
): SimulationState['risks'] {
  return state.risks.map((risk) => {
    let probability = risk.probability;
    let severity = risk.severity;

    if (metrics.timePressure >= 75) {
      probability = clamp(probability + 0.04, 0.05, 0.95);
    } else if (metrics.timePressure <= 35) {
      probability = clamp(probability - 0.03, 0.05, 0.95);
    }

    if (metrics.risk >= 70 && severity !== 'critical') {
      // nudge toward higher severity when aggregate risk is high
      if (severity === 'low') severity = 'medium';
      else if (severity === 'medium' && metrics.risk >= 80) severity = 'high';
    }

    if (metrics.successProbability >= 75 && metrics.timePressure < 40) {
      probability = clamp(probability - 0.02, 0.05, 0.95);
    }

    return { ...risk, probability, severity };
  });
}
