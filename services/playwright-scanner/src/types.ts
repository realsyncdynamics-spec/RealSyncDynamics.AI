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
