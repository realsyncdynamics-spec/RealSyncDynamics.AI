// Kanonische Tenant-Auflösung für Edge Functions.
//
// Warum dieser Helfer existiert: Es gab bisher keine gemeinsame Stelle, die aus
// einer authentifizierten User-ID den Tenant ableitet. Stattdessen führten
// einzelne Functions private Kopien derselben Abfrage (`marketing-event`,
// `kodee-onboard`), und `create-trial-subscription` las `profiles.active_tenant_id`
// — eine Spalte, die in keiner Migration existiert.
//
// Kanonisch ist `public.memberships` (aus `organization_members` umbenannt in
// 20260430160000). `tenant_memberships` wird bewusst NICHT verwendet: die
// Tabelle hat null Nutzungen im Code, wird vom Signup-Trigger nicht befüllt und
// driftet seit ihrem einmaligen Backfill.
//
// Sicherheit: Der Tenant wird ausschließlich aus der User-ID abgeleitet, die aus
// einem verifizierten JWT stammt. Ein vom Browser mitgeschickter `tenant_id` darf
// niemals in diese Funktion fließen — sonst wäre Tenant-Isolation umgehbar.

/** Minimales Interface — hält den Helfer testbar ohne echten Supabase-Client. */
export interface TenantLookupClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        order(column: string, opts: { ascending: boolean }): {
          limit(n: number): Promise<{ data: Array<{ tenant_id: string; role: string }> | null; error: unknown }>;
        };
      };
    };
  };
}

/**
 * Liefert den Tenant des Users oder `null`, wenn keine Mitgliedschaft besteht.
 *
 * Bevorzugt die `owner`-Mitgliedschaft: `handle_new_auth_user`
 * (20260501000000) legt bei jedem Signup genau eine solche an, das ist also der
 * Workspace des Users selbst. Gehört ein User mehreren Tenants an, fällt die
 * Auflösung deterministisch auf die alphabetisch erste Rolle zurück, statt eine
 * beliebige Zeile zu greifen.
 */
export async function resolveTenantForUser(
  admin: TenantLookupClient,
  userId: string,
): Promise<string | null> {
  if (!userId) return null;

  const { data, error } = await admin
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .order('role', { ascending: true })
    .limit(10);

  if (error || !data || data.length === 0) return null;

  const owner = data.find((row) => row.role === 'owner');
  return (owner ?? data[0]).tenant_id ?? null;
}

/**
 * Prüft, ob der User Mitglied des Tenants ist.
 *
 * Wird zusätzlich zur Auflösung aufgerufen, damit der Autorisierungs-Check auch
 * dann greift, wenn der Tenant auf einem anderen Weg bestimmt wurde.
 */
export async function userBelongsToTenant(
  admin: TenantLookupClient,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  if (!userId || !tenantId) return false;

  const { data, error } = await admin
    .from('memberships')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .order('role', { ascending: true })
    .limit(50);

  if (error || !data) return false;
  return data.some((row) => row.tenant_id === tenantId);
}
