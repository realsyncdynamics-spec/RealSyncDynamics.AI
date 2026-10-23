/**
 * Schreibrecht im KI-Register für die aktive Rolle — eine Quelle für
 * Register-Leerzustand und Onboarding-Assistent.
 *
 * Spiegelt nur die Serverprüfung (owner/admin gegen `memberships` in
 * governance-resources/create_asset), damit Nutzer ohne Recht den Hinweis
 * vor dem Ausfüllen sehen statt danach ein 403. Maßgeblich bleibt der Server.
 */
import { useTenant } from '../../../core/access/TenantProvider';
import { useLang } from '../../../i18n/useLang';
import { canEditRegistry } from './registryModel';

export function useCanEditRegistry(): boolean {
  const { activeTenantId, tenants } = useTenant();
  return canEditRegistry(tenants.find((x) => x.tenantId === activeTenantId)?.role);
}

/** Hinweis „ansehen ja, registrieren nein“; Stil kommt vom Aufrufer. */
export function RegistryWriteNotice({ className }: { className?: string }) {
  const { t } = useLang();
  return (
    <p role="note" className={className} data-testid="registry-write-locked">
      {t('regLockedGuided')}
    </p>
  );
}
