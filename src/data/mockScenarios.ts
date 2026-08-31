import type {
  Constraint,
  Goal,
  Resource,
  Risk,
  Scenario,
  Task,
  TeamMember,
} from '../types';
import { createId } from '../utils/helpers';

export const SAMPLE_GOAL: Goal = {
  id: 'goal_product_launch',
  title: 'Ship MVP product launch',
  description:
    'Deliver a production-ready MVP to early customers with stable core flows, launch messaging, and support coverage.',
  successCriteria: [
    'Core user journeys work end-to-end',
    'Critical bugs resolved before go-live',
    'Launch checklist signed off by product and engineering',
  ],
};

export const SAMPLE_TEAM: TeamMember[] = [
  {
    id: 'tm_maya',
    name: 'Maya Chen',
    role: 'Product Lead',
    capacity: 80,
    skills: ['roadmap', 'stakeholders', 'prioritization'],
  },
  {
    id: 'tm_jordan',
    name: 'Jordan Hale',
    role: 'Frontend Engineer',
    capacity: 90,
    skills: ['React', 'TypeScript', 'design systems'],
  },
  {
    id: 'tm_sam',
    name: 'Sam Okonkwo',
    role: 'Backend Engineer',
    capacity: 85,
    skills: ['APIs', 'reliability', 'data modeling'],
  },
  {
    id: 'tm_riley',
    name: 'Riley Park',
    role: 'Designer',
    capacity: 70,
    skills: ['UX', 'prototyping', 'research'],
  },
];

export const SAMPLE_RESOURCES: Resource[] = [
  {
    id: 'res_budget',
    name: 'Project budget',
    type: 'budget',
    amount: 48000,
    unit: 'USD',
    remaining: 31200,
  },
  {
    id: 'res_cloud',
    name: 'Cloud credits',
    type: 'infrastructure',
    amount: 5000,
    unit: 'USD',
    remaining: 3400,
  },
  {
    id: 'res_tools',
    name: 'Tooling licenses',
    type: 'tools',
    amount: 12,
    unit: 'seats',
    remaining: 9,
  },
  {
    id: 'res_buffer',
    name: 'Schedule buffer',
    type: 'time',
    amount: 5,
    unit: 'days',
    remaining: 3,
  },
];

export const SAMPLE_CONSTRAINTS: Constraint[] = [
  {
    id: 'c_compliance',
    label: 'Privacy review required',
    description: 'Legal must approve data handling before launch.',
    hard: true,
  },
  {
    id: 'c_no_hiring',
    label: 'No permanent hires',
    description: 'Headcount freeze; contractors allowed with budget approval.',
    hard: true,
  },
  {
    id: 'c_brand',
    label: 'Brand guidelines',
    description: 'Marketing assets must follow the current brand system.',
    hard: false,
  },
];

export const SAMPLE_TASKS: Task[] = [
  {
    id: 'task_auth',
    title: 'Finalize authentication flows',
    description: 'Complete sign-in, recovery, and session handling.',
    status: 'in_progress',
    assigneeId: 'tm_jordan',
    estimatedDays: 3,
    dayStart: 1,
    dayEnd: 4,
    priority: 'high',
  },
  {
    id: 'task_api',
    title: 'Stabilize core API endpoints',
    description: 'Harden rate limits, error contracts, and monitoring.',
    status: 'in_progress',
    assigneeId: 'tm_sam',
    estimatedDays: 4,
    dayStart: 1,
    dayEnd: 5,
    priority: 'high',
  },
  {
    id: 'task_onboarding',
    title: 'Polish onboarding experience',
    description: 'Reduce drop-off in first-session activation.',
    status: 'pending',
    assigneeId: 'tm_riley',
    estimatedDays: 3,
    dayStart: 3,
    dayEnd: 6,
    priority: 'medium',
  },
  {
    id: 'task_qa',
    title: 'Run launch QA pass',
    description: 'Regression suite across critical customer journeys.',
    status: 'pending',
    assigneeId: 'tm_maya',
    estimatedDays: 2,
    dayStart: 7,
    dayEnd: 9,
    priority: 'high',
  },
  {
    id: 'task_docs',
    title: 'Prepare support playbook',
    description: 'Document known issues, escalation paths, and FAQs.',
    status: 'pending',
    assigneeId: 'tm_maya',
    estimatedDays: 2,
    dayStart: 6,
    dayEnd: 8,
    priority: 'medium',
  },
  {
    id: 'task_infra',
    title: 'Production readiness checklist',
    description: 'Alerts, backups, rollback plan, and capacity review.',
    status: 'blocked',
    assigneeId: 'tm_sam',
    estimatedDays: 2,
    dayStart: 5,
    dayEnd: 7,
    priority: 'high',
  },
  {
    id: 'task_messaging',
    title: 'Finalize launch messaging',
    description: 'Align product and marketing on launch copy and channels.',
    status: 'pending',
    assigneeId: 'tm_riley',
    estimatedDays: 2,
    dayStart: 4,
    dayEnd: 6,
    priority: 'medium',
  },
  {
    id: 'task_analytics',
    title: 'Wire launch analytics',
    description: 'Instrument funnel events needed for go-live monitoring.',
    status: 'pending',
    assigneeId: 'tm_jordan',
    estimatedDays: 2,
    dayStart: 5,
    dayEnd: 7,
    priority: 'low',
  },
];

export const SAMPLE_RISKS: Risk[] = [
  {
    id: 'risk_scope',
    title: 'Scope creep before launch',
    description: 'Late feature requests may crowd out QA and polish.',
    severity: 'medium',
    probability: 0.45,
    mitigation: 'Freeze non-critical scope after day 4.',
  },
  {
    id: 'risk_api',
    title: 'API instability under load',
    description: 'Peak traffic during launch window may expose latency spikes.',
    severity: 'high',
    probability: 0.35,
    mitigation: 'Add load tests and temporary capacity headroom.',
  },
  {
    id: 'risk_review',
    title: 'Privacy review delay',
    description: 'Legal queue is congested; approval may slip.',
    severity: 'medium',
    probability: 0.3,
    mitigation: 'Submit packet early and schedule a review slot.',
  },
];

export function createSampleScenario(): Scenario {
  const now = Date.now();
  return {
    id: createId('scenario'),
    name: 'Product Launch Sprint',
    goal: { ...SAMPLE_GOAL, id: createId('goal') },
    deadlineDays: 10,
    resources: SAMPLE_RESOURCES.map((r) => ({ ...r, id: createId('res') })),
    team: SAMPLE_TEAM.map((m) => ({ ...m, id: m.id })),
    constraints: SAMPLE_CONSTRAINTS.map((c) => ({ ...c })),
    riskTolerance: 'medium',
    createdAt: now - 1000 * 60 * 60 * 24 * 2,
    lastOpenedAt: now - 1000 * 60 * 60 * 5,
  };
}

export function createSecondSampleScenario(): Scenario {
  const now = Date.now();
  return {
    id: createId('scenario'),
    name: 'Office Relocation Window',
    goal: {
      id: createId('goal'),
      title: 'Complete team relocation',
      description:
        'Move the team to the new workspace with minimal downtime and full desk readiness.',
      successCriteria: [
        'Network and access live on move day',
        'All critical roles seated and productive within 48 hours',
      ],
    },
    deadlineDays: 14,
    resources: [
      {
        id: createId('res'),
        name: 'Move budget',
        type: 'budget',
        amount: 22000,
        unit: 'USD',
        remaining: 18500,
      },
      {
        id: createId('res'),
        name: 'Vendor slots',
        type: 'tools',
        amount: 4,
        unit: 'crews',
        remaining: 3,
      },
    ],
    team: [
      {
        id: createId('tm'),
        name: 'Alex Rivera',
        role: 'Ops Lead',
        capacity: 95,
        skills: ['logistics', 'vendors'],
      },
      {
        id: createId('tm'),
        name: 'Priya Nair',
        role: 'IT Specialist',
        capacity: 85,
        skills: ['networking', 'hardware'],
      },
    ],
    constraints: [
      {
        id: createId('c'),
        label: 'Business continuity',
        description: 'Customer support cannot go offline for more than 4 hours.',
        hard: true,
      },
    ],
    riskTolerance: 'low',
    createdAt: now - 1000 * 60 * 60 * 24 * 6,
    lastOpenedAt: now - 1000 * 60 * 60 * 24 * 3,
  };
}

export function createAgentDemoScenario(): Scenario {
  const now = Date.now();
  const team = [
    {
      id: 'tm_lead',
      name: 'Aisha Khan',
      role: 'Project Lead',
      capacity: 85,
      skills: ['coordination', 'pitch', 'stakeholders'],
    },
    {
      id: 'tm_dev',
      name: 'Leo Martinez',
      role: 'Full-stack Developer',
      capacity: 90,
      skills: ['React', 'APIs', 'prototyping'],
    },
    {
      id: 'tm_design',
      name: 'Priya Desai',
      role: 'UX Designer',
      capacity: 75,
      skills: ['research', 'prototyping', 'storytelling'],
    },
  ];

  return {
    id: createId('scenario'),
    name: 'Launch a Student Innovation Project',
    goal: {
      id: createId('goal'),
      title: 'Launch a student innovation showcase',
      description:
        'Deliver a polished demo, judging rubric, and outreach plan for a campus innovation fair with limited budget and a fixed event date.',
      successCriteria: [
        'Working prototype demoed end-to-end',
        'Judging rubric and mentor brief published',
        'Outreach reaches 200+ students before launch day',
      ],
    },
    deadlineDays: 10,
    startDay: 1,
    resources: [
      {
        id: 'res_budget',
        name: 'Project stipend',
        type: 'budget',
        amount: 1200,
        unit: 'USD',
        remaining: 680,
      },
      {
        id: 'res_lab',
        name: 'Maker lab hours',
        type: 'time',
        amount: 24,
        unit: 'hours',
        remaining: 14,
      },
      {
        id: 'res_swag',
        name: 'Event swag kits',
        type: 'tools',
        amount: 50,
        unit: 'kits',
        remaining: 32,
      },
    ],
    team,
    constraints: [
      {
        id: 'c_date',
        label: 'Fixed showcase date',
        description: 'The innovation fair date cannot move — only internal scope can flex.',
        hard: true,
      },
      {
        id: 'c_budget',
        label: 'Stipend cap',
        description: 'Cannot exceed the approved $1,200 stipend without faculty approval.',
        hard: true,
      },
      {
        id: 'c_team',
        label: 'No additional hires',
        description: 'Only the three core team members; contractors need lead approval.',
        hard: false,
      },
    ],
    riskTolerance: 'medium',
    createdAt: now,
    lastOpenedAt: now,
    initialTasks: [
      {
        id: 'task_proto',
        title: 'Build interactive prototype',
        description: 'Core demo flow for judges and visitors.',
        status: 'in_progress',
        assigneeId: 'tm_dev',
        estimatedDays: 4,
        dayStart: 1,
        dayEnd: 5,
        priority: 'high',
      },
      {
        id: 'task_rubric',
        title: 'Finalize judging rubric',
        description: 'Criteria, weights, and mentor scoring sheet.',
        status: 'in_progress',
        assigneeId: 'tm_lead',
        estimatedDays: 2,
        dayStart: 1,
        dayEnd: 3,
        priority: 'high',
      },
      {
        id: 'task_research',
        title: 'User research synthesis',
        description: 'Summarize interviews into design insights.',
        status: 'pending',
        assigneeId: 'tm_design',
        estimatedDays: 2,
        dayStart: 2,
        dayEnd: 4,
        priority: 'medium',
      },
      {
        id: 'task_outreach',
        title: 'Campus outreach campaign',
        description: 'Posters, mailing list, and student org partnerships.',
        status: 'pending',
        assigneeId: 'tm_lead',
        estimatedDays: 3,
        dayStart: 3,
        dayEnd: 6,
        priority: 'high',
      },
      {
        id: 'task_polish',
        title: 'Demo polish & rehearsal',
        description: 'Script, transitions, and backup plan for live demo.',
        status: 'pending',
        assigneeId: 'tm_design',
        estimatedDays: 2,
        dayStart: 6,
        dayEnd: 8,
        priority: 'high',
      },
      {
        id: 'task_infra',
        title: 'Event logistics checklist',
        description: 'Venue setup, AV, signage, and volunteer roles.',
        status: 'blocked',
        assigneeId: 'tm_lead',
        estimatedDays: 2,
        dayStart: 5,
        dayEnd: 7,
        priority: 'high',
      },
      {
        id: 'task_mentor',
        title: 'Mentor briefing packet',
        description: 'Guide for faculty judges and industry mentors.',
        status: 'pending',
        assigneeId: 'tm_lead',
        estimatedDays: 1,
        dayStart: 4,
        dayEnd: 5,
        priority: 'medium',
      },
      {
        id: 'task_metrics',
        title: 'Impact tracking dashboard',
        description: 'Track sign-ups, attendance, and feedback.',
        status: 'pending',
        assigneeId: 'tm_dev',
        estimatedDays: 2,
        dayStart: 5,
        dayEnd: 7,
        priority: 'low',
      },
    ],
    initialRisks: [
      {
        id: 'risk_scope',
        title: 'Feature creep before showcase',
        description: 'New demo ideas may crowd out rehearsal and outreach.',
        severity: 'high',
        probability: 0.5,
        mitigation: 'Freeze scope after day 4; cut nice-to-haves.',
      },
      {
        id: 'risk_budget',
        title: 'Stipend overrun',
        description: 'Swag and lab costs may exceed remaining stipend.',
        severity: 'medium',
        probability: 0.4,
        mitigation: 'Track spend daily; defer non-essential purchases.',
      },
      {
        id: 'risk_capacity',
        title: 'Team overload',
        description: 'Three-person team carrying eight parallel workstreams.',
        severity: 'high',
        probability: 0.45,
        mitigation: 'Reduce scope or add contractor capacity with stipend.',
      },
    ],
  };
}

export const DEMO_SCENARIOS: Scenario[] = [
  createAgentDemoScenario(),
  createSampleScenario(),
  createSecondSampleScenario(),
];
