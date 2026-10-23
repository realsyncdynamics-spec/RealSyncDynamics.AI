/**
 * WP-4 — Beta-Feedback (docs/claude/BETA_V5_WORKPLAN.md).
 *
 * Prüft die reine Logik der Client-Schicht und — am Quelltext — dass die
 * Migration die Zugriffsregeln trägt: Schreiben nur unter eigener user_id im
 * eigenen Mandanten, Team-Lesen nur über `is_platform_operator()`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_MAX,
  feedbackRoute,
  isForbiddenError,
  validateFeedbackText,
} from '../../../src/features/beta/betaFeedbackApi';

const root = (p: string) => resolve(__dirname, '../../..', p);
const MIGRATION = readFileSync(root('supabase/migrations/20261022090000_beta_feedback.sql'), 'utf8');
const BANNER = readFileSync(root('src/components/governance-os/BetaAppBanner.tsx'), 'utf8');
const SHELL = readFileSync(root('src/components/governance-os/GovernanceBrowserShell.tsx'), 'utf8');
const APP = readFileSync(root('src/App.tsx'), 'utf8');

describe('validateFeedbackText', () => {
  it('weist leere und zu kurze Texte ab', () => {
    expect(validateFeedbackText('').ok).toBe(false);
    expect(validateFeedbackText('  \n ').ok).toBe(false);
    expect(validateFeedbackText('ab').ok).toBe(false);
  });

  it('trimmt und normalisiert Zeilenumbrüche', () => {
    const r = validateFeedbackText('  Scan zeigt nichts\r\nobwohl Cookies da sind  ');
    expect(r).toEqual({ ok: true, text: 'Scan zeigt nichts\nobwohl Cookies da sind' });
  });

  it('deckelt auf die Tabellen-Constraint', () => {
    expect(validateFeedbackText('x'.repeat(FEEDBACK_MAX)).ok).toBe(true);
    expect(validateFeedbackText('x'.repeat(FEEDBACK_MAX + 1)).ok).toBe(false);
    expect(MIGRATION).toContain(`length(text) <= ${FEEDBACK_MAX}`);
  });
});

describe('feedbackRoute', () => {
  it('speichert nur den Pfad — keine Query, kein Hash, kein Token', () => {
    expect(feedbackRoute('/app/websites?token=abc#x')).toBe('/app/websites');
    expect(feedbackRoute('app/dashboard')).toBe('/app/dashboard');
    expect(feedbackRoute('/' + 'a'.repeat(600)).length).toBe(512);
  });
});

describe('isForbiddenError', () => {
  it('erkennt die RPC-Ablehnung für Nicht-Operatoren', () => {
    expect(isForbiddenError('forbidden')).toBe(true);
    expect(isForbiddenError('permission denied for function admin_beta_feedback')).toBe(true);
    expect(isForbiddenError('network error')).toBe(false);
  });
});

describe('Migration 20261022090000_beta_feedback.sql', () => {
  it('erzwingt eigene user_id und Mitgliedschaft beim Schreiben', () => {
    const insert = MIGRATION.slice(MIGRATION.indexOf('CREATE POLICY "beta_feedback_member_insert"'));
    const policy = insert.slice(0, insert.indexOf(';'));
    expect(policy).toContain('FOR INSERT TO authenticated');
    expect(policy).toContain('user_id = (SELECT auth.uid())');
    expect(policy).toContain('public.is_tenant_member(tenant_id)');
  });

  it('gibt authenticated nur SELECT und INSERT — kein UPDATE/DELETE', () => {
    expect(MIGRATION).toContain('GRANT SELECT, INSERT ON public.beta_feedback TO authenticated');
    expect(MIGRATION).not.toMatch(/FOR (UPDATE|DELETE) TO authenticated/);
  });

  it('Team-Ansicht prüft die Plattform-Rolle in der Datenbank', () => {
    const fn = MIGRATION.slice(MIGRATION.indexOf('FUNCTION public.admin_beta_feedback'));
    expect(fn).toContain('SECURITY DEFINER');
    expect(fn).toContain('IF NOT public.is_platform_operator() THEN');
    expect(fn).toContain("ERRCODE = '42501'");
  });

  it('ist additiv: keine DROP TABLE, keine ALTER an Bestandsobjekten', () => {
    expect(MIGRATION).not.toMatch(/DROP TABLE/i);
    expect(MIGRATION).not.toMatch(/ALTER TABLE public\.(?!beta_feedback)/);
  });
});

describe('Verdrahtung in der App', () => {
  it('Beta-Hinweis verlinkt nicht mehr auf das Kontaktformular', () => {
    expect(BANNER).not.toContain('/kontakt?topic=beta-feedback');
    expect(BANNER).toContain('<BetaFeedbackButton variant="link" />');
  });

  it('Feedback-Knopf hängt in der App-Shell, Admin-Ansicht ist geroutet', () => {
    expect(SHELL).toContain('<BetaFeedbackButton variant="floating" />');
    expect(APP).toContain('path="/admin/beta-feedback"');
  });
});
