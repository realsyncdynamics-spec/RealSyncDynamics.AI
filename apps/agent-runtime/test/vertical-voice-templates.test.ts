import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  effectiveVoiceTools,
  toVoiceBotConfigFields,
  validateVerticalVoiceAgent,
  VERTICAL_VOICE_TEMPLATES,
  VERTICAL_VOICE_TOOL_IDS,
  type VerticalVoiceAgentConfig,
} from '../src/vertical-voice-templates.js';
import { VOICE_TOOLS } from '../src/voice-tools.js';

const base: VerticalVoiceAgentConfig = {
  agentId: 'demo-agent',
  tenantId: 'demo-tenant',
  templateId: 'butcher',
  displayName: 'Bestellassistent',
  businessName: 'Testmetzgerei',
  locale: 'de-DE',
  channels: ['web'],
  lifecycle: 'active',
  enabledTools: ['lookup_kb', 'create_ticket'],
  recordingEnabled: false,
  transcriptStorageEnabled: false,
  retentionDays: 0,
  humanHandoffContact: 'team@example.invalid',
  privacyReviewApprovedAt: null,
};

describe('vertical voice template safety', () => {
  it('keeps all three sector templates', () => {
    assert.deepEqual(Object.keys(VERTICAL_VOICE_TEMPLATES).sort(), ['butcher', 'law_office', 'trades']);
  });

  it('uses only tool names from the voice contract', () => {
    for (const template of Object.values(VERTICAL_VOICE_TEMPLATES)) {
      for (const tool of template.allowedTools) {
        assert.ok(VERTICAL_VOICE_TOOL_IDS.includes(tool), `${template.id}: ${tool}`);
        assert.ok(Object.prototype.hasOwnProperty.call(VOICE_TOOLS, tool), `${template.id}: ${tool}`);
      }
    }
  });

  it('never offers export_transcript through a template', () => {
    for (const template of Object.values(VERTICAL_VOICE_TEMPLATES)) {
      assert.equal(template.allowedTools.includes('export_transcript'), false, template.id);
    }
  });

  it('discloses the AI interaction in every greeting', () => {
    for (const template of Object.values(VERTICAL_VOICE_TEMPLATES)) {
      assert.match(template.greeting, /\bKI-/, template.id);
    }
  });

  it('prevents cross-industry escalation', () => {
    const config: VerticalVoiceAgentConfig = { ...base, enabledTools: ['lookup_kb', 'schedule_appointment'] };
    assert.ok(validateVerticalVoiceAgent(config).includes('Nicht erlaubtes Tool für diese Branche.'));
    assert.deepEqual(effectiveVoiceTools(config), []);
  });

  it('returns no execution tools when agent is paused, in review or in draft', () => {
    assert.deepEqual(effectiveVoiceTools({ ...base, lifecycle: 'paused' }), []);
    assert.deepEqual(effectiveVoiceTools({ ...base, lifecycle: 'review' }), []);
    assert.deepEqual(effectiveVoiceTools({ ...base, lifecycle: 'draft' }), []);
  });

  it('returns the deduplicated template intersection for a valid active agent', () => {
    const config: VerticalVoiceAgentConfig = {
      ...base,
      enabledTools: ['create_ticket', 'lookup_kb', 'create_ticket'],
    };
    assert.deepEqual(validateVerticalVoiceAgent(config), []);
    assert.deepEqual(effectiveVoiceTools(config), ['create_ticket', 'lookup_kb']);
  });

  it('fails closed for an active agent with any validation error', () => {
    assert.deepEqual(effectiveVoiceTools({ ...base, channels: ['web', 'phone'] }), []);
    assert.deepEqual(effectiveVoiceTools({ ...base, recordingEnabled: true }), []);
    assert.deepEqual(effectiveVoiceTools({ ...base, humanHandoffContact: '  ' }), []);
    assert.deepEqual(effectiveVoiceTools({ ...base, tenantId: ' ' }), []);
  });

  it('blocks unimplemented phone and recording capability', () => {
    const errors = validateVerticalVoiceAgent({ ...base, channels: ['web', 'phone'], recordingEnabled: true });
    assert.ok(errors.some((e) => e.includes('Telefonie')));
    assert.ok(errors.some((e) => e.includes('Audio-Aufzeichnung')));
  });

  it('requires an explicit retention period for transcript storage', () => {
    assert.ok(
      validateVerticalVoiceAgent({ ...base, transcriptStorageEnabled: true, retentionDays: 0 }).includes(
        'Transkriptspeicherung benötigt eine explizite Aufbewahrungsfrist.',
      ),
    );
    assert.ok(
      validateVerticalVoiceAgent({ ...base, retentionDays: 31 }).includes(
        'Aufbewahrungsfrist muss zwischen 0 und 30 Tagen liegen.',
      ),
    );
  });

  it('requires human handoff for an active agent', () => {
    assert.ok(
      validateVerticalVoiceAgent({ ...base, humanHandoffContact: null }).includes(
        'Für aktive Agenten muss eine menschliche Übergabe möglich sein.',
      ),
    );
  });

  it('rejects an unknown template id even if forced through the type', () => {
    const config = { ...base, templateId: 'clinic' } as unknown as VerticalVoiceAgentConfig;
    assert.ok(validateVerticalVoiceAgent(config).includes('Unbekannte Branchenvorlage.'));
    assert.deepEqual(effectiveVoiceTools(config), []);
    assert.deepEqual(toVoiceBotConfigFields(config).offered_tools, []);
  });

  it('accepts an isolated, web-only draft', () => {
    assert.deepEqual(validateVerticalVoiceAgent({ ...base, lifecycle: 'draft', humanHandoffContact: null }), []);
  });
});

describe('runtime validation of untrusted JSON (review SEC-04)', () => {
  /** Simuliert einen Request-Body: Typen gelten zur Laufzeit nicht. */
  const forged = (patch: Record<string, unknown>): VerticalVoiceAgentConfig =>
    ({ ...base, ...patch }) as unknown as VerticalVoiceAgentConfig;

  const cases: Array<[string, VerticalVoiceAgentConfig, string]> = [
    ['unknown lifecycle', forged({ lifecycle: 'superadmin' }), 'Unbekannter Lebenszyklus-Status.'],
    ['lifecycle as number', forged({ lifecycle: 1 }), 'Unbekannter Lebenszyklus-Status.'],
    ['empty channels', forged({ channels: [] }), 'Kanäle ungültig: mindestens ein bekannter Kanal, keine Duplikate.'],
    ['unknown channel', forged({ channels: ['fax'] }), 'Kanäle ungültig: mindestens ein bekannter Kanal, keine Duplikate.'],
    ['duplicate channel', forged({ channels: ['web', 'web'] }), 'Kanäle ungültig: mindestens ein bekannter Kanal, keine Duplikate.'],
    ['channels as string', forged({ channels: 'web' }), 'Kanäle ungültig: mindestens ein bekannter Kanal, keine Duplikate.'],
    ['unknown tool', forged({ enabledTools: ['lookup_kb', 'drop_tables'] }), 'Tool-Liste ungültig.'],
    ['tools as object', forged({ enabledTools: { 0: 'lookup_kb' } }), 'Tool-Liste ungültig.'],
    ['recording as string', forged({ recordingEnabled: 'false' }), 'Feld recordingEnabled muss true oder false sein.'],
    ['retention as string', forged({ retentionDays: '7' }), 'Feld retentionDays muss eine Zahl sein.'],
    ['tenantId as number', forged({ tenantId: 42 }), 'Feld tenantId fehlt oder ist kein Text.'],
    ['missing agentId', forged({ agentId: undefined }), 'Feld agentId fehlt oder ist kein Text.'],
    ['handoff as object', forged({ humanHandoffContact: { email: 'x' } }), 'Feld humanHandoffContact muss Text oder null sein.'],
  ];

  for (const [name, config, expected] of cases) {
    it(`rejects ${name} without throwing and without tools`, () => {
      assert.ok(validateVerticalVoiceAgent(config).includes(expected), name);
      assert.deepEqual(effectiveVoiceTools(config), []);
      assert.deepEqual(toVoiceBotConfigFields(config), { language: 'de-DE', offered_tools: [], status: 'draft' });
    });
  }

  it('rejects non-object input', () => {
    for (const input of [null, 'config', 7, []]) {
      const config = input as unknown as VerticalVoiceAgentConfig;
      assert.deepEqual(validateVerticalVoiceAgent(config), ['Konfiguration ist kein Objekt.']);
      assert.deepEqual(effectiveVoiceTools(config), []);
      assert.equal(toVoiceBotConfigFields(config).status, 'draft');
    }
  });
});

describe('law office template (elevated data sensitivity)', () => {
  const kanzlei: VerticalVoiceAgentConfig = {
    ...base,
    templateId: 'law_office',
    displayName: 'Kanzlei-Assistenz',
    businessName: 'Testkanzlei',
    enabledTools: ['lookup_kb', 'create_ticket', 'handoff_human'],
  };

  it('blocks activation without a documented privacy review', () => {
    assert.ok(
      validateVerticalVoiceAgent(kanzlei).includes(
        'Diese Branche benötigt vor der Aktivierung eine dokumentierte Datenschutzprüfung.',
      ),
    );
    assert.deepEqual(effectiveVoiceTools(kanzlei), []);
    assert.deepEqual(effectiveVoiceTools({ ...kanzlei, privacyReviewApprovedAt: 'kein Datum' }), []);
  });

  it('rejects timestamps that Date.parse alone would accept (review SEC-02)', () => {
    const now = new Date('2026-10-24T12:00:00.000Z');
    for (const value of [
      '1',
      '2026',
      '2026-02-30T00:00:00Z',
      '2026-10-20T09:00:00+02:00',
      '2026-10-20',
      '2099-01-01T00:00:00.000Z',
    ]) {
      assert.deepEqual(effectiveVoiceTools({ ...kanzlei, privacyReviewApprovedAt: value }, now), [], value);
    }
    assert.deepEqual(
      effectiveVoiceTools({ ...kanzlei, privacyReviewApprovedAt: '2026-10-20T09:00:00Z' }, now),
      ['lookup_kb', 'create_ticket', 'handoff_human'],
    );
  });

  it('allows a draft without review and activation after review', () => {
    assert.deepEqual(validateVerticalVoiceAgent({ ...kanzlei, lifecycle: 'draft' }), []);
    const reviewed = { ...kanzlei, privacyReviewApprovedAt: '2026-10-20T09:00:00.000Z' };
    assert.deepEqual(validateVerticalVoiceAgent(reviewed), []);
    assert.deepEqual(effectiveVoiceTools(reviewed), ['lookup_kb', 'create_ticket', 'handoff_human']);
  });

  it('never forbids the handoff triggers that protect deadlines', () => {
    assert.ok(VERTICAL_VOICE_TEMPLATES.law_office.humanHandoffTriggers.includes('Fristsache'));
    assert.ok(VERTICAL_VOICE_TEMPLATES.law_office.forbiddenClaims.includes('Frist geprüft'));
  });
});

describe('mapping to public.voice_bot_configs', () => {
  it('persists review as draft and never as active', () => {
    assert.equal(toVoiceBotConfigFields({ ...base, lifecycle: 'review' }).status, 'draft');
  });

  it('persists an invalid active configuration as draft', () => {
    assert.equal(toVoiceBotConfigFields({ ...base, channels: ['phone'] }).status, 'draft');
  });

  it('keeps paused and valid active states', () => {
    assert.equal(toVoiceBotConfigFields({ ...base, lifecycle: 'paused' }).status, 'paused');
    assert.deepEqual(toVoiceBotConfigFields(base), {
      language: 'de-DE',
      offered_tools: ['lookup_kb', 'create_ticket'],
      status: 'active',
    });
  });

  it('drops tools outside the template from offered_tools', () => {
    const fields = toVoiceBotConfigFields({
      ...base,
      lifecycle: 'draft',
      enabledTools: ['lookup_kb', 'schedule_appointment', 'export_transcript'],
    });
    assert.deepEqual(fields.offered_tools, ['lookup_kb']);
  });
});
