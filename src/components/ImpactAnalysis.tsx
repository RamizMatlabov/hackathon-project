import type { Consequence, DecisionResult, ImpactStep } from '../types';

interface ImpactAnalysisProps {
  preview: DecisionResult | null;
}

function StepBlock({ step, index }: { step: ImpactStep; index: number }) {
  return (
    <div className={`impact-step impact-step--${step.kind}`}>
      <span className="impact-step__index">{index + 1}</span>
      <div>
        <strong>{step.label}</strong>
        {step.detail && <p>{step.detail}</p>}
      </div>
    </div>
  );
}

function ConsequenceRow({ item }: { item: Consequence }) {
  return (
    <li className={`consequence-row consequence-row--${item.type}`}>
      <span className="consequence-row__type">{item.type}</span>
      <div>
        <strong>{item.title}</strong>
        <p>{item.description}</p>
      </div>
      {item.severity && (
        <span className={`consequence-row__severity consequence-row__severity--${item.severity}`}>
          {item.severity}
        </span>
      )}
    </li>
  );
}

export function ImpactAnalysis({ preview }: ImpactAnalysisProps) {
  return (
    <section className="panel impact-analysis" aria-labelledby="impact-heading">
      <header className="panel__header">
        <h2 id="impact-heading">Impact Analysis</h2>
        <p>Decision → effects → emergent consequences → new world state</p>
      </header>

      {!preview && (
        <div className="impact-analysis__empty">
          <p>Select a decision to preview how the simulated world will change.</p>
        </div>
      )}

      {preview && (
        <div className="impact-analysis__body">
          <div className="impact-chain" role="list">
            {preview.impactChain.map((step, index) => (
              <div key={`${step.kind}-${step.label}-${index}`} role="listitem">
                <StepBlock step={step} index={index} />
                {index < preview.impactChain.length - 1 && (
                  <div className="impact-chain__arrow" aria-hidden="true">
                    ↓
                  </div>
                )}
              </div>
            ))}
          </div>

          {preview.consequences.length > 0 && (
            <div>
              <span className="impact-analysis__label">Consequence graph</span>
              <ul className="consequence-list">
                {preview.consequences.map((item) => (
                  <ConsequenceRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          )}

          <div className="impact-analysis__meta">
            <div>
              <span className="impact-analysis__label">Estimated impact</span>
              <strong className={`impact-pill impact-pill--${preview.estimatedImpact}`}>
                {preview.estimatedImpact}
              </strong>
            </div>
            {preview.possibleRisks.length > 0 && (
              <div>
                <span className="impact-analysis__label">Possible risks</span>
                <ul className="impact-analysis__risks">
                  {preview.possibleRisks.map((risk) => (
                    <li key={risk}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
