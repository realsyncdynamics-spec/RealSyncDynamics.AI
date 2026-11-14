// Posteingang-Anbindung einer SiteOS-Seite (PR C, `site_inbox_bindings`).
//
// Existiert für das Website-Projekt ein Binding, bekommt das Artefakt den
// Endpunkt von `inbox-form-submit` und die `site_ref` — auch bei
// `enabled = false`: Die Function entscheidet fail-closed, und Einschalten
// braucht dann keine Neuveröffentlichung. Ohne Binding bleibt das Artefakt
// byte-identisch zum bisherigen Stand.
//
// Bewertung (publish-gate), Preview und Produktion bauen das Artefakt je
// neu und vergleichen Hashes (G6). Alle drei müssen deshalb denselben
// Helfer mit denselben Eingaben rufen.

import type { InboxFormOptions } from '../../../packages/siteos-core/src/index.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export async function loadInboxOptions(
  admin: AdminClient,
  tenantId: string,
  projectId: string | null | undefined,
): Promise<InboxFormOptions | undefined> {
  if (!projectId) return undefined;

  const { data: binding } = await admin
    .from('site_inbox_bindings')
    .select('site_ref')
    .eq('tenant_id', tenantId)
    .eq('website_project_id', projectId)
    .maybeSingle();
  const siteRef = typeof binding?.site_ref === 'string' ? binding.site_ref : '';
  if (!/^[A-Za-z0-9_-]{24}$/.test(siteRef)) return undefined;

  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  if (!base) return undefined;
  return { siteRef, endpoint: `${base}/functions/v1/inbox-form-submit` };
}
