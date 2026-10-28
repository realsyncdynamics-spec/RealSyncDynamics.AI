// Baustein A (G2, 25.10.2026) — Rollen und Vier-Augen-Regel als reine
// Funktion. Dieselben Fälle prüft `test/runtime/db/siteos-four-eyes.db.test.ts`
// gegen den Datenbank-Trigger; beide Seiten müssen übereinstimmen.

import { describe, expect, it } from 'vitest';
import {
  SELF_APPROVAL_MIN_REASON,
  SITE_APPROVER_ROLES,
  SITE_EDITOR_ROLES,
  canEditSite,
  checkApproval,
  type ApprovalCheckInput,
} from '../../supabase/functions/siteos/approval-policy';

const AUTHOR = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
const LONG_REASON = 'Einziger Verantwortlicher; Inhalte selbst geprüft und dokumentiert.';

function input(over: Partial<ApprovalCheckInput> = {}): ApprovalCheckInput {
  return {
    approverId: OTHER,
    approverRole: 'admin',
    authorId: AUTHOR,
    eligibleApproverCount: 2,
    reason: 'Inhalt geprüft, freigegeben.',
    ...over,
  };
}

describe('SiteOS / Rollen', () => {
  it('bearbeiten dürfen owner, admin, editor — dpo und viewer_auditor nicht', () => {
    expect([...SITE_EDITOR_ROLES].sort()).toEqual(['admin', 'editor', 'owner']);
    expect(canEditSite('owner')).toBe(true);
    expect(canEditSite('admin')).toBe(true);
    expect(canEditSite('editor')).toBe(true);
    expect(canEditSite('dpo')).toBe(false);
    expect(canEditSite('viewer_auditor')).toBe(false);
    expect(canEditSite(null)).toBe(false);
    expect(canEditSite(undefined)).toBe(false);
  });

  it('freigeben dürfen owner, admin, dpo — editor und viewer_auditor nicht', () => {
    expect([...SITE_APPROVER_ROLES].sort()).toEqual(['admin', 'dpo', 'owner']);
    for (const role of ['editor', 'viewer_auditor', 'unknown']) {
      const r = checkApproval(input({ approverRole: role }));
      expect(r).toMatchObject({ allowed: false, status: 403, code: 'FORBIDDEN' });
    }
  });

  it('Rolle und Bearbeitung sind getrennt: keine Rolle darf beides außer owner/admin', () => {
    const both = [...SITE_EDITOR_ROLES].filter((r) => SITE_APPROVER_ROLES.has(r)).sort();
    expect(both).toEqual(['admin', 'owner']);
  });
});

describe('SiteOS / Vier-Augen-Regel', () => {
  it('eine andere berechtigte Person darf freigeben', () => {
    expect(checkApproval(input())).toEqual({ allowed: true, selfApproval: false });
    expect(checkApproval(input({ approverRole: 'dpo' }))).toEqual({ allowed: true, selfApproval: false });
  });

  it('der Autor darf nicht freigeben, solange es weitere Freigabeberechtigte gibt', () => {
    const r = checkApproval(input({ approverId: AUTHOR, eligibleApproverCount: 2, reason: LONG_REASON }));
    expect(r).toMatchObject({ allowed: false, status: 403, code: 'FOUR_EYES' });
  });

  it('Solo-Mandant: dokumentierte Selbstfreigabe mit ausreichender Begründung', () => {
    const r = checkApproval(input({ approverId: AUTHOR, eligibleApproverCount: 1, reason: LONG_REASON }));
    expect(r).toEqual({ allowed: true, selfApproval: true });
  });

  it('Solo-Mandant: zu kurze Begründung reicht für eine Selbstfreigabe nicht', () => {
    const short = 'x'.repeat(SELF_APPROVAL_MIN_REASON - 1);
    const r = checkApproval(input({ approverId: AUTHOR, eligibleApproverCount: 1, reason: short }));
    expect(r).toMatchObject({ allowed: false, code: 'FOUR_EYES' });
    const exact = 'x'.repeat(SELF_APPROVAL_MIN_REASON);
    expect(checkApproval(input({ approverId: AUTHOR, eligibleApproverCount: 1, reason: exact })))
      .toEqual({ allowed: true, selfApproval: true });
  });

  it('kein freigabeberechtigtes Mitglied gezählt ⇒ keine Selbstfreigabe (fail-closed)', () => {
    const r = checkApproval(input({ approverId: AUTHOR, eligibleApproverCount: 0, reason: LONG_REASON }));
    expect(r).toMatchObject({ allowed: false, code: 'FOUR_EYES' });
  });

  it('unbekannter Autor ⇒ keine Freigabe (fail-closed)', () => {
    const r = checkApproval(input({ authorId: null }));
    expect(r).toMatchObject({ allowed: false, status: 409, code: 'AUTHOR_UNKNOWN' });
  });

  it('Rollenprüfung geht der Autorprüfung vor', () => {
    const r = checkApproval(input({ approverRole: 'editor', authorId: null }));
    expect(r).toMatchObject({ code: 'FORBIDDEN' });
  });
});
