/**
 * Contract-Tests für tenant-audit's Issue→Finding-Mapping.
 *
 * Die Edge Function selbst ist ein Deno-Wrapper um `fetch`+`scan-pipeline`;
 * sie wird in der Migration-Validation + manuell gegen Staging geprüft.
 * Hier locken wir die pure Mapping-Heuristik (Category + Confidence +
 * Evidence-Level) so, dass Drift im Detector nicht unbemerkt durch das
 * Schema rutscht.
 */
import { describe, it, expect } from 'vitest';
import {
  categoryFor,
  confidenceFor,
  evidenceLevelFor,
} from '../../supabase/functions/_shared/audit-mapping';

describe('tenant-audit categoryFor', () => {
  it('maps consent / cookie / banner → consent', () => {
    expect(categoryFor('tracker_no_consent')).toBe('consent');
    expect(categoryFor('cookie_dark_pattern')).toBe('consent');
    expect(categoryFor('consent_banner_missing')).toBe('consent');
  });
  it('maps tracker / pixel / analytics → tracker', () => {
    expect(categoryFor('social_pixel_no_consent')).toBe('consent');     // consent wins
    expect(categoryFor('ga_analytics_loaded')).toBe('tracker');
    expect(categoryFor('pixel_meta_loaded')).toBe('tracker');
  });
  it('maps ai / chatbot → ai_act', () => {
    expect(categoryFor('chatbot_no_disclosure')).toBe('ai_act');
    expect(categoryFor('ai_endpoint_unclassified')).toBe('ai_act');
  });
  it('maps dpa / avv / vendor → dpa', () => {
    expect(categoryFor('vendor_no_dpa')).toBe('dpa');
    expect(categoryFor('avv_missing_google')).toBe('dpa');
  });
  it('maps header / hsts / csp / tls → security', () => {
    expect(categoryFor('hsts_missing')).toBe('security');
    expect(categoryFor('csp_weak')).toBe('security');
    expect(categoryFor('header_x_frame_options')).toBe('security');
  });
  it('maps impressum / privacy / datenschutz → transparency', () => {
    expect(categoryFor('impressum_missing')).toBe('transparency');
    expect(categoryFor('privacy_policy_outdated')).toBe('transparency');
    expect(categoryFor('datenschutz_unvollständig')).toBe('transparency');
  });
  it('maps dpia / vvt / register → documentation', () => {
    expect(categoryFor('dpia_missing_for_ai')).toBe('documentation');
    expect(categoryFor('vvt_entry_missing')).toBe('documentation');
  });
  it('maps fetch_failed → other', () => {
    expect(categoryFor('fetch_failed')).toBe('other');
  });
  it('falls back to other for unknown', () => {
    expect(categoryFor('random_unknown_check')).toBe('other');
    expect(categoryFor('')).toBe('other');
  });
});

describe('tenant-audit confidenceFor', () => {
  it('fetch_failed gets low confidence (0.3)', () => {
    expect(confidenceFor('fetch_failed')).toBe(0.30);
  });
  it('vendor/inferred get medium confidence (0.7)', () => {
    expect(confidenceFor('vendor_no_dpa')).toBe(0.70);
    expect(confidenceFor('inferred_vendor_x')).toBe(0.70);
  });
  it('direct observations default to 0.85', () => {
    expect(confidenceFor('tracker_no_consent')).toBe(0.85);
    expect(confidenceFor('hsts_missing')).toBe(0.85);
  });
});

describe('tenant-audit evidenceLevelFor', () => {
  it('fetch_failed is unverifiable', () => {
    expect(evidenceLevelFor('fetch_failed')).toBe('unverifiable');
  });
  it('vendor/inferred are inferred', () => {
    expect(evidenceLevelFor('vendor_no_dpa')).toBe('inferred');
    expect(evidenceLevelFor('inferred_pii')).toBe('inferred');
  });
  it('default is observed', () => {
    expect(evidenceLevelFor('tracker_no_consent')).toBe('observed');
    expect(evidenceLevelFor('cookie_dark_pattern')).toBe('observed');
  });
});
