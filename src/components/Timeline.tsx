import type { Task } from '../types';

interface TimelineProps {
  day: number;
  deadlineDays: number;
  tasks: Task[];
}

export function Timeline({ day, deadlineDays, tasks }: TimelineProps) {
  const days = Array.from({ length: deadlineDays }, (_, i) => i + 1);

  return (
    <section className="panel timeline" aria-labelledby="timeline-heading">
      <header className="panel__header">
        <h2 id="timeline-heading">Timeline</h2>
        <p>
          Day {day} of {deadlineDays}
        </p>
      </header>

      <div className="timeline__ruler" role="list" aria-label="Simulation days">
        {days.map((d) => (
          <div
            key={d}
            role="listitem"
            className={`timeline__day ${d === day ? 'is-current' : ''} ${d < day ? 'is-past' : ''}`}
          >
            <span>{d}</span>
          </div>
        ))}
      </div>

      <ul className="timeline__lanes">
        {tasks.map((task) => {
          const start = Math.max(1, task.dayStart);
          const end = Math.min(deadlineDays, task.dayEnd);
          const left = ((start - 1) / deadlineDays) * 100;
          const width = ((end - start + 1) / deadlineDays) * 100;

          return (
            <li key={task.id} className="timeline__lane">
              <span className="timeline__label">{task.title}</span>
              <div className="timeline__track">
                <div
                  className={`timeline__bar timeline__bar--${task.status}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }}
                  title={`${task.title}: day ${start}–${end}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
