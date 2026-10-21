/**
 * Secure, conservative routing for the AI OS assistant.
 * No client-supplied model/provider is trusted. No cloud path exists here.
 * Data classification is an audit hint, NOT an authorization override.
 */
export type DataClass = 'public' | 'internal' | 'personal' | 'special_category' | 'unknown';
export type WorkPurpose = 'general' | 'web' | 'governance' | 'compliance' | 'automation';
export type RouteSelection = 'auto' | 'eu_precise';
export type AssistantRoute =
  | { allowed: true; profile: 'fast-local' | 'quality-local'; zone: 'eu_private'; reason: string }
  | { allowed: false; code: 'RUNTIME_NOT_VERIFIED' | 'TENANT_POLICY_CONFLICT' | 'UNSUPPORTED_SELECTION' | 'DATA_CLASS_REVIEW_REQUIRED' | 'LEGAL_BASIS_REQUIRED'; reason: string };

const PURPOSES = new Set<WorkPurpose>(['general', 'web', 'governance', 'compliance', 'automation']);
const CLASSES = new Set<DataClass>(['public', 'internal', 'personal', 'special_category', 'unknown']);

export function routeGovernedAssistant(args: {
  runtimeVerified: boolean;
  tenantPolicy: string;
  purpose: unknown;
  dataClass: unknown;
  selection: unknown;
}): AssistantRoute {
  if (!PURPOSES.has(args.purpose as WorkPurpose)
      || !CLASSES.has(args.dataClass as DataClass)
      || (args.selection !== 'auto' && args.selection !== 'eu_precise')) {
    return { allowed: false, code: 'UNSUPPORTED_SELECTION', reason: 'Unbekannter Zweck, Datenklasse oder Ausführungswunsch.' };
  }
  // A user declaration is NOT proof of a valid GDPR legal basis or AI Act
  // intended-use review. Until the data inventory and approvals are wired,
  // do not send personal/special-category/unknown content to ANY model.
  if (args.dataClass === 'unknown') {
    return { allowed: false, code: 'DATA_CLASS_REVIEW_REQUIRED', reason: 'Die Datenklasse muss vor dem Modellaufruf festgelegt und geprüft werden.' };
  }
  if (args.dataClass === 'personal' || args.dataClass === 'special_category') {
    return { allowed: false, code: 'LEGAL_BASIS_REQUIRED', reason: 'Personenbezogene Daten benötigen vor KI-Verarbeitung eine geprüfte Rechtsgrundlage und Freigabe.' };
  }
  if (args.tenantPolicy !== 'user_choice' && args.tenantPolicy !== 'enforce_eu_local') {
    return { allowed: false, code: 'TENANT_POLICY_CONFLICT', reason: 'Mandantenrichtlinie verlangt Cloud, aber für diesen Assistenten ist kein geprüfter Cloud-Pfad freigeschaltet.' };
  }
  if (!args.runtimeVerified) {
    return { allowed: false, code: 'RUNTIME_NOT_VERIFIED', reason: 'Die EU-Ausführungsumgebung ist noch nicht durch den Betreiber verifiziert.' };
  }
  const profile = args.selection === 'eu_precise'
    || args.purpose === 'governance'
    || args.purpose === 'compliance'
    || args.dataClass === 'special_category'
    ? 'quality-local' : 'fast-local';
  return { allowed: true, profile, zone: 'eu_private', reason: 'Verifizierter EU-Privatpfad ohne Cloud-Fallback; keine Tool-Ausführung.' };
}
