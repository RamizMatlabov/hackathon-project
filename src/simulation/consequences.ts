import type {
  Consequence,
  ConsequenceSeverity,
  ConsequenceType,
  ImpactStep,
} from '../types';
import { stableId } from '../utils/helpers';

export function makeConsequence(input: {
  type: ConsequenceType;
  title: string;
  description: string;
  metric?: string;
  value?: number;
  severity?: ConsequenceSeverity;
  key?: string;
}): Consequence {
  return {
    id: stableId('cq', input.key ?? input.type, input.title),
    type: input.type,
    title: input.title,
    description: input.description,
    metric: input.metric,
    value: input.value,
    severity: input.severity,
  };
}

export function consequencesToImpactChain(
  decisionTitle: string,
  decisionDescription: string,
  consequences: Consequence[],
  outcomeLabel?: string,
): ImpactStep[] {
  const chain: ImpactStep[] = [
    { kind: 'decision', label: decisionTitle, detail: decisionDescription },
  ];

  for (const c of consequences) {
    chain.push({
      kind: c.type === 'emergent' ? 'emergent' : c.type,
      label: c.title,
      detail: c.description,
    });
  }

  if (outcomeLabel) {
    chain.push({ kind: 'outcome', label: outcomeLabel });
  }

  return chain;
}

export function consequenceSummaries(consequences: Consequence[]): string[] {
  return consequences.map((c) => `${c.title}: ${c.description}`);
}
