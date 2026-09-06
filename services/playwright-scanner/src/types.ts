// Request/Response-Interfaces — synchronisiert mit cookie-scan Edge Function
// (supabase/functions/cookie-scan/index.ts ScanResult).
//
// Bei Schema-Änderungen IMMER beide Seiten anpassen — das Frontend konsumiert
// beide Endpoints (light = Edge Function, deep = dieser Microservice) und
// erwartet ein einheitliches Format.

export type Severity = 'pass' | 'low' | 'medium' | 'high' | 'critical';

export type CookieCategory = 'essential' | 'tracking' | 'unknown';

export interface Cookie {
  name: string;
  value_preview: string;          // erste 8 Zeichen, Rest maskiert
  domain: string | null;
  path: string | null;
  expires: string | null;
  http_only: boolean;
  secure: boolean;
  same_site: string | null;
  category: CookieCategory;
  third_party: boolean;
  set_before_consent: boolean;
}

export type TrackerCategory = 'analytics' | 'advertising' | 'ux' | 'consent_manager';

export interface Tracker {
  id: string;
  name: string;
  category: TrackerCategory;
  pattern_matched: string;
  consent_compliant: boolean;
  // Microservice-only: Loaded VOR oder NACH Consent-Click?
  loaded_before_consent?: boolean;
}

export interface FormDescriptor {
  action: string | null;
  method: string;                 // 'GET' | 'POST' (lowercased zu uppercase normalisiert)
  has_email_field: boolean;
  has_password_field: boolean;
  has_phone_field: boolean;
  has_textarea: boolean;
  has_visible_consent_link: boolean;   // Privacy/Datenschutz-Link im Form
  inputs: Array<{ name: string | null; type: string | null }>;
}

export interface FormAnalysis {
  total_forms: number;
  has_email_field: boolean;
  has_password_field: boolean;
  has_phone_field: boolean;
  contact_form_detected: boolean;
  signup_form_detected: boolean;
  visible_consent_link: boolean;
  forms: FormDescriptor[];        // Microservice-only: detail pro Form
}

export interface PrivacyAnalytics {
  id: string;
  name: string;
  pattern_matched: string;
}

export interface ScanMeta {
  url: string;
  domain: string;
  fetched_status: number | null;
  scanned_at: string;             // ISO-8601
  user_agent: string;
  duration_ms: number;
  redirect_chain: string[];
  fetch_error: string | null;
  scanner_version: string;
}

export interface ScanResult {
  ok: true;
  meta: ScanMeta;
  cookies: Cookie[];
  trackers: Tracker[];
  privacy_analytics: PrivacyAnalytics[];
  consent_manager_detected: boolean;
  forms: FormAnalysis;
  local_storage: Record<string, string>;     // key → value-preview (max 200 chars)
  session_storage: Record<string, string>;
  network_requests_count: number;
  third_party_hosts: string[];               // dedupliziert
  unknown_third_party_scripts: Array<{ host: string; sample_url: string }>;
  score: number;                             // 0..100
  severity: Severity;
  summary: string;
}

export interface ScanRequest {
  url: string;
  options?: {
    timeout?: number;             // ms, default 30000, max 60000
    waitFor?: string;             // CSS-Selector — auf Element warten bevor scan
    user_agent?: string;          // Override UA
  };
}

export interface ScanError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ─── Beobachtung für Browser Agent X07 (§02 des Organisationsmodells) ────────
//
// Getrennt von ScanResult, weil es eine andere Frage beantwortet: ScanResult
// sagt „ist diese Seite DSGVO-konform", ObserveResult sagt „funktioniert diese
// Seite im Browser". Ein gemeinsames Format hätte beide Seiten verwässert.

export interface ViewportSpec {
  width: number;
  height: number;
  label?: string;
}

export interface ObserveOptions {
  timeout?: number;
  viewports?: ViewportSpec[];
  /** CSS-Selektoren, die sichtbar und vollständig im Viewport liegen müssen. */
  expect_visible?: string[];
  user_agent?: string;
}

export interface ObserveRequest {
  url: string;
  options?: ObserveOptions;
}

export interface ConsoleEntry {
  level: 'error' | 'warning';
  text: string;
  url: string | null;
  line: number | null;
}

export interface FailedRequest {
  url: string;
  method: string;
  /** Netzwerkfehler (z.B. `net::ERR_NAME_NOT_RESOLVED`), sonst null. */
  failure: string | null;
  /** HTTP-Status ab 400, sonst null. */
  status: number | null;
}

export interface SelectorObservation {
  selector: string;
  found: boolean;
  visible: boolean;
  /** Sichtbar UND vollständig innerhalb der Viewport-Breite. */
  within_viewport: boolean;
  right: number | null;
}

export interface ViewportObservation {
  label: string;
  width: number;
  height: number;
  document_scroll_width: number;
  horizontal_overflow: boolean;
  selectors: SelectorObservation[];
  /** Gesetzt, wenn diese Breite gar nicht geladen hat. */
  load_error?: string;
}

export interface ObserveResult {
  ok: true;
  meta: {
    url: string;
    final_url: string | null;
    http_status: number | null;
    duration_ms: number;
    observer_version: string;
    observed_at: string;
  };
  console_errors: ConsoleEntry[];
  console_warnings: ConsoleEntry[];
  page_errors: string[];
  failed_requests: FailedRequest[];
  /** Navigation-Timing-API. KEIN Lighthouse — siehe Kopf von observe.ts. */
  timings: {
    response_start_ms: number;
    dom_content_loaded_ms: number;
    load_ms: number;
  } | null;
  viewports: ViewportObservation[];
}
