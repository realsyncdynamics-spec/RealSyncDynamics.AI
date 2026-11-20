import { lazy, Suspense } from 'react';
import { isGovernanceAiEnabled } from '../../config/featureFlags';
import { GovernanceAiUnavailable } from '../governance/dashboard/GovernanceAiRoute';

/**
 * Route-Element für `/app/workspace`. Gleicher Schalter wie `/app/assistant`
 * (`VITE_GOVERNANCE_AI_ENABLED`, Standard aus): ohne Freigabe wird der
 * Workspace weder geladen noch gehen `ai-gateway`-Aufrufe raus.
 */
const GovernanceWorkspace = lazy(() =>
  import('./GovernanceWorkspace').then((m) => ({ default: m.GovernanceWorkspace })),
);

export function GovernanceWorkspaceRoute() {
  if (!isGovernanceAiEnabled()) return <GovernanceAiUnavailable />;
  return (
    <Suspense fallback={null}>
      <GovernanceWorkspace />
    </Suspense>
  );
}
