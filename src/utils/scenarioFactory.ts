import type { Scenario, ScenarioDraft } from '../types';
import { createId } from '../utils/helpers';

const EMPTY_DRAFT: ScenarioDraft = {
  name: '',
  goalTitle: '',
  goalDescription: '',
  successCriteria: '',
  deadlineDays: 10,
  resourcesText: '',
  teamText: '',
  constraintsText: '',
  riskTolerance: 'medium',
};

export function createEmptyDraft(): ScenarioDraft {
  return { ...EMPTY_DRAFT };
}

export function createDraftFromTemplate(): ScenarioDraft {
  return {
    name: 'Product Launch Sprint',
    goalTitle: 'Ship MVP product launch',
    goalDescription:
      'Deliver a production-ready MVP to early customers with stable core flows and launch readiness.',
    successCriteria:
      'Core journeys work end-to-end\nCritical bugs resolved\nLaunch checklist signed off',
    deadlineDays: 10,
    resourcesText: 'Budget: 48000 USD\nCloud credits: 5000 USD\nSchedule buffer: 3 days',
    teamText: 'Maya Chen — Product Lead\nJordan Hale — Frontend Engineer\nSam Okonkwo — Backend Engineer\nRiley Park — Designer',
    constraintsText: 'Privacy review required\nNo permanent hires\nBrand guidelines',
    riskTolerance: 'medium',
  };
}

function parseLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseResourceLine(line: string) {
  const match = line.match(/^(.+?):\s*([\d.,]+)\s*(.*)$/i);
  if (match) {
    const amount = Number(match[2].replace(/,/g, '')) || 0;
    const unit = match[3].trim() || 'units';
    const name = match[1].trim();
    const lower = `${name} ${unit}`.toLowerCase();
    const type = lower.includes('budget') || lower.includes('usd') || unit.toUpperCase() === 'USD'
      ? 'budget' as const
      : lower.includes('day')
        ? 'time' as const
        : lower.includes('seat') || lower.includes('license') || lower.includes('tool')
          ? 'tools' as const
          : lower.includes('cloud') || lower.includes('infra')
            ? 'infrastructure' as const
            : 'other' as const;

    return {
      id: createId('res'),
      name,
      type,
      amount,
      unit,
      remaining: amount,
    };
  }

  return {
    id: createId('res'),
    name: line,
    type: 'other' as const,
    amount: 1,
    unit: 'units',
    remaining: 1,
  };
}

function parseTeamLine(line: string) {
  const [namePart, rolePart] = line.split('—').map((p) => p.trim());
  const name = namePart || `Teammate ${createId('tm').slice(-4)}`;
  const role = rolePart || 'Contributor';
  return {
    id: createId('tm'),
    name,
    role,
    capacity: 80,
    skills: [role.toLowerCase()],
  };
}

export function draftToScenario(draft: ScenarioDraft): Scenario {
  const now = Date.now();
  const criteria = parseLines(draft.successCriteria);
  const resources = parseLines(draft.resourcesText).map(parseResourceLine);
  const team = parseLines(draft.teamText).map(parseTeamLine);
  const constraints = parseLines(draft.constraintsText).map((label) => ({
    id: createId('c'),
    label,
    description: label,
    hard: !label.toLowerCase().includes('guideline'),
  }));

  return {
    id: createId('scenario'),
    name: draft.name.trim() || 'Untitled scenario',
    goal: {
      id: createId('goal'),
      title: draft.goalTitle.trim() || 'Untitled goal',
      description: draft.goalDescription.trim() || 'No description provided.',
      successCriteria: criteria.length > 0 ? criteria : ['Define measurable success criteria'],
    },
    deadlineDays: Math.max(1, Math.min(90, Number(draft.deadlineDays) || 10)),
    resources:
      resources.length > 0
        ? resources
        : [
            {
              id: createId('res'),
              name: 'General budget',
              type: 'budget',
              amount: 10000,
              unit: 'USD',
              remaining: 10000,
            },
          ],
    team:
      team.length > 0
        ? team
        : [
            {
              id: createId('tm'),
              name: 'Solo Operator',
              role: 'Generalist',
              capacity: 90,
              skills: ['execution'],
            },
          ],
    constraints:
      constraints.length > 0
        ? constraints
        : [
            {
              id: createId('c'),
              label: 'Stay within available resources',
              description: 'Do not exceed declared budget and capacity.',
              hard: true,
            },
          ],
    riskTolerance: draft.riskTolerance,
    createdAt: now,
    lastOpenedAt: now,
  };
}

export function isDraftValid(draft: ScenarioDraft): boolean {
  return Boolean(draft.name.trim() && draft.goalTitle.trim() && draft.deadlineDays > 0);
}
