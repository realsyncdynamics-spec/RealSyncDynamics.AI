import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';
process.env.MCP_KEY_PEPPER ??= 'test-pepper-mit-mindestens-32-zeichen-laenge';

const {
  listControls,
  getGovernanceStatus,
  checkComplianceStatus,
  UnknownFrameworkError,
  NotImplementedError,
  KNOWN_FRAMEWORKS,
} = await import('../src/tools/governance.js');

/**
 * Diese Tests fassen die Annahmen fest, die aus der Messung gegen die
 * Live-Datenbank stammen (2026-08-31). Kein Netzwerkzugriff: geprüft wird die
 * Auflösung der Framework-Schlüssel und die Zusicherung, dass die beiden
 * anderen Werkzeuge weiterhin verweigern statt zu raten.
 */

test('Schreibweisen desselben Frameworks lösen gleich auf', async () => {
  // Die Datenbank führt ISO 27001 als `iso27001` (Fremdschlüssel) und als
  // `ISO_27001` (Textspalte). Beide Schreibweisen — und die Bindestrich-Form
  // aus der alten Werkzeugbeschreibung — müssen dasselbe Framework treffen.
  for (const spelling of ['iso27001', 'ISO_27001', 'iso-27001', 'ISO 27001']) {
    await assert.doesNotReject(
      // Der Aufruf scheitert am fehlenden Netzwerk, nicht an der Auflösung —
      // entscheidend ist, dass er NICHT mit UnknownFrameworkError endet.
      async () => {
        try {
          await listControls('t', spelling);
        } catch (err) {
          if (err instanceof UnknownFrameworkError) throw err;
        }
      },
      `"${spelling}" wurde nicht aufgelöst`,
    );
  }
});

test('EU AI Act ist unter beiden Benennungen erreichbar', async () => {
  // `compliance_frameworks.code` sagt `ai_act`, die Textspalte `EU_AI_ACT`.
  // Eine rein algorithmische Ableitung scheitert genau an diesem Paar.
  for (const spelling of ['ai_act', 'EU_AI_ACT', 'euaiact']) {
    try {
      await listControls('t', spelling);
    } catch (err) {
      assert.ok(
        !(err instanceof UnknownFrameworkError),
        `"${spelling}" wurde nicht aufgelöst`,
      );
    }
  }
});

test('unbekanntes Framework wird abgewiesen, nicht stillschweigend geleert', async () => {
  await assert.rejects(
    () => listControls('t', 'iso9001'),
    (err: unknown) => err instanceof UnknownFrameworkError && err.name === 'UnknownFrameworkError',
  );
});

test('die Fehlermeldung nennt die gültigen Schlüssel', async () => {
  try {
    await listControls('t', 'quatsch');
    assert.fail('hätte werfen müssen');
  } catch (err) {
    const msg = (err as Error).message;
    // Ohne diese Aufzählung müsste der Aufrufer raten.
    for (const f of ['iso42001', 'gdpr', 'dora']) {
      assert.ok(msg.includes(f), `"${f}" fehlt in der Meldung: ${msg}`);
    }
  }
});

test('alle acht gemessenen Frameworks sind bekannt', () => {
  const keys = KNOWN_FRAMEWORKS.map((f) => f.key).sort();
  assert.deepEqual(keys, [
    'ai_act',
    'dora',
    'gdpr',
    'iso27001',
    'iso42001',
    'nis2',
    'soc2',
    'tisax',
  ]);
});

test('get_status verweigert weiterhin und nennt den Datengrund', async () => {
  // Wichtig: Der Score darf NICHT als 0 zurückkommen. framework_implementations
  // ist leer — "0 von 219" läse sich als Befund "nicht konform".
  await assert.rejects(
    () => getGovernanceStatus('t', 'iso42001'),
    (err: unknown) =>
      err instanceof NotImplementedError &&
      /framework_implementations/.test((err as Error).message),
  );
});

test('check_compliance verweigert weiterhin und nennt den Datengrund', async () => {
  await assert.rejects(
    () => checkComplianceStatus('t', 'A.5.1'),
    (err: unknown) =>
      err instanceof NotImplementedError &&
      /asset_control_mappings/.test((err as Error).message),
  );
});
