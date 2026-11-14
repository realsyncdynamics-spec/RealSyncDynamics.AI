import { lazy, Suspense } from 'react';
import { isCreativeStudioEditorEnabled } from '../../config/featureFlags';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { creativeStudioGate } from './access';

const SocialDesignEditor = lazy(() =>
  import('./SocialDesignEditor').then((m) => ({ default: m.SocialDesignEditor })),
);

function Loading() {
  return (
    <div
      className="flex min-h-[240px] items-center justify-center bg-obsidian-950"
      role="status"
      data-testid="creative-studio-loading"
    >
      <span className="font-mono text-xs text-titanium-500">Berechtigungen werden geladen …</span>
    </div>
  );
}

/**
 * `/app/creative-studio`. Flag aus → die NotFound-Seite des Repos, der
 * Editor-Chunk wird nicht geladen. Flag an, Entitlements noch unklar →
 * Ladezustand, nicht der Editor.
 */
export function CreativeStudioRoute() {
  const tenant = useOptionalTenant();
  const gate = creativeStudioGate({
    flagEnabled: isCreativeStudioEditorEnabled(),
    entitlementsLoading: tenant?.loading ?? true,
  });
  if (gate === 'closed') return <NotFoundPage />;
  if (gate === 'loading') return <Loading />;
  return (
    <Suspense fallback={<Loading />}>
      <SocialDesignEditor />
    </Suspense>
  );
}

export default CreativeStudioRoute;
