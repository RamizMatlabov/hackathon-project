import type { Resource, Risk, Task, TeamMember } from '../types';

interface ResourceListProps {
  resources: Resource[];
}

export function ResourceList({ resources }: ResourceListProps) {
  return (
    <section className="panel" aria-labelledby="resources-heading">
      <header className="panel__header">
        <h2 id="resources-heading">Resources</h2>
        <p>Available capacity and spend</p>
      </header>
      <ul className="metric-list">
        {resources.map((resource) => {
          const pct = resource.amount > 0 ? Math.round((resource.remaining / resource.amount) * 100) : 0;
          return (
            <li key={resource.id} className="metric-row">
              <div className="metric-row__top">
                <strong>{resource.name}</strong>
                <span>
                  {resource.remaining.toLocaleString()} / {resource.amount.toLocaleString()} {resource.unit}
                </span>
              </div>
              <div className="metric-row__bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface TeamListProps {
  team: TeamMember[];
}

export function TeamList({ team }: TeamListProps) {
  return (
    <section className="panel" aria-labelledby="team-heading">
      <header className="panel__header">
        <h2 id="team-heading">Team</h2>
        <p>{team.length} active members</p>
      </header>
      <ul className="people-list">
        {team.map((member) => (
          <li key={member.id} className="person-row">
            <div className="person-row__avatar" aria-hidden="true">
              {member.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <strong>{member.name}</strong>
              <p>
                {member.role} · {member.capacity}% capacity
              </p>
              <p className="person-row__skills">{member.skills.join(' · ')}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TaskBoardProps {
  tasks: Task[];
}

const TASK_LABELS: Record<Task['status'], string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  blocked: 'Blocked',
  needs_restructure: 'Needs restructure',
  completed: 'Completed',
};

export function TaskBoard({ tasks }: TaskBoardProps) {
  return (
    <section className="panel" aria-labelledby="tasks-heading">
      <header className="panel__header">
        <h2 id="tasks-heading">Tasks & events</h2>
        <p>Current workstream state</p>
      </header>
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={`task-row task-row--${task.status}`}>
            <div className="task-row__main">
              <strong>{task.title}</strong>
              <p>{task.description}</p>
            </div>
            <div className="task-row__meta">
              <span className={`chip chip--${task.status}`}>{TASK_LABELS[task.status]}</span>
              <span className="chip">Day {task.dayStart}–{task.dayEnd}</span>
              <span className={`chip chip--priority-${task.priority}`}>{task.priority}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface RiskListProps {
  risks: Risk[];
}

export function RiskList({ risks }: RiskListProps) {
  return (
    <section className="panel" aria-labelledby="risks-heading">
      <header className="panel__header">
        <h2 id="risks-heading">Risks</h2>
        <p>Active exposure in the scenario</p>
      </header>
      <ul className="risk-list">
        {risks.map((risk) => (
          <li key={risk.id} className={`risk-row risk-row--${risk.severity}`}>
            <div className="risk-row__top">
              <strong>{risk.title}</strong>
              <span className={`chip chip--severity-${risk.severity}`}>{risk.severity}</span>
            </div>
            <p>{risk.description}</p>
            <p className="risk-row__mitigation">
              Mitigation: {risk.mitigation} · P={Math.round(risk.probability * 100)}%
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
