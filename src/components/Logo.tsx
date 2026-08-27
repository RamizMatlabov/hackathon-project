interface LogoProps {
  compact?: boolean;
  onClick?: () => void;
}

export function Logo({ compact = false, onClick }: LogoProps) {
  const className = `logo ${compact ? 'logo--compact' : ''} ${onClick ? 'logo--button' : ''}`;

  const content = (
    <>
      <span className="logo__mark" aria-hidden="true">
        <span className="logo__orbit" />
        <span className="logo__core" />
      </span>
      <span className="logo__text">
        <span className="logo__name">LifeSim</span>
        {!compact && <span className="logo__tag">Decision Simulation</span>}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label="Go to LifeSim home">
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
