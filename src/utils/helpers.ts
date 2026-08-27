export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDay(day: number, deadline: number): string {
  const remaining = Math.max(0, deadline - day);
  if (remaining === 0) return 'Deadline today';
  if (remaining === 1) return '1 day remaining';
  return `${remaining} days remaining`;
}

export function severityRank(severity: string): number {
  switch (severity) {
    case 'low':
      return 0;
    case 'medium':
      return 1;
    case 'high':
      return 2;
    case 'critical':
      return 3;
    default:
      return 1;
  }
}

export function rankToSeverity(rank: number): 'low' | 'medium' | 'high' | 'critical' {
  if (rank <= 0) return 'low';
  if (rank === 1) return 'medium';
  if (rank === 2) return 'high';
  return 'critical';
}
