interface WhatHappensNextProps {
  narrative: string;
}

export function WhatHappensNext({ narrative }: WhatHappensNextProps) {
  return (
    <section className="panel what-next" aria-labelledby="what-next-heading">
      <header className="panel__header">
        <h2 id="what-next-heading">What happens next?</h2>
        <p>Generated from the live simulation state</p>
      </header>
      <p className="what-next__text">{narrative}</p>
    </section>
  );
}
