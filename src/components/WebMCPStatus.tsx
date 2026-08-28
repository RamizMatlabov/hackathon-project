import type { WebMCPRegistrationInfo } from '../webmcp/types';

interface WebMCPStatusProps {
  registration: WebMCPRegistrationInfo;
  hasSimulation: boolean;
}

const STATUS_LABEL: Record<WebMCPRegistrationInfo['status'], string> = {
  unsupported: 'Unsupported',
  available: 'Available',
  registering: 'Registering',
  ready: 'Ready',
  registration_error: 'Registration Error',
};

const STATUS_COPY: Record<WebMCPRegistrationInfo['status'], string> = {
  unsupported: 'This browser does not expose document.modelContext.',
  available: 'WebMCP API detected. Registering LifeSim tools…',
  registering: 'Registering LifeSim tools with document.modelContext…',
  ready: 'LifeSim tools are available to compatible AI agents.',
  registration_error: 'Some tools failed to register. Open the debug panel for details.',
};

export function WebMCPStatus({ registration, hasSimulation }: WebMCPStatusProps) {
  const isReady = registration.status === 'ready';

  return (
    <aside
      className={`webmcp-status webmcp-status--${registration.status}`}
      aria-live="polite"
      aria-label="WebMCP agent status"
    >
      <span className="webmcp-status__dot" aria-hidden />
      <div className="webmcp-status__text">
        <strong>
          WebMCP · {STATUS_LABEL[registration.status]}
        </strong>
        <span>{STATUS_COPY[registration.status]}</span>
        {(isReady || registration.status === 'registration_error') && (
          <span className="webmcp-status__meta">
            {registration.registeredToolCount} / {registration.expectedToolCount} tools
            {registration.verifiedViaGetTools ? ' verified' : ' registered'}
            {hasSimulation ? ' · simulation active' : ' · open a scenario to act'}
          </span>
        )}
      </div>
    </aside>
  );
}
