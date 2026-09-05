// P2-2 — Verdrahtung der Microsoft-365-Anbindung, am Quelltext geprüft.
//
// ## Warum am Quelltext und nicht am Verhalten
//
// Dass sich zwei Stellen gleich verhalten, ist kein Beleg dafür, dass sie
// dieselbe Stelle benutzen — dieselbe Überlegung wie in
// `bot-pep-wiring.test.ts`. Ein Abholjob, der die Bewertung nachbaut statt den
// gemeinsamen PEP zu rufen, besteht jeden Verhaltenstest und ist trotzdem
// genau der Fragmentierungsbefund aus §1.4 des Enforcement-Plans.
//
// Dazu kommen hier zwei Eigenschaften, die kein Typ und kein Verhaltenstest
// sieht: dass das App-Geheimnis nie in eine Antwort gerät, und dass die
// Erweiterung einer bestehenden CHECK-Bedingung nichts wegnimmt.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SYNC = 'supabase/functions/microsoft365-audit-sync/index.ts';
const CONNECT = 'supabase/functions/microsoft365-connect/index.ts';
const GRAPH = 'supabase/functions/_shared/m365/graph.ts';
const MIGRATION = 'supabase/migrations/20260905100000_microsoft365_connector.sql';
const CONFIG = 'supabase/config.toml';

const sync = readFileSync(SYNC, 'utf8');
const connect = readFileSync(CONNECT, 'utf8');
const graph = readFileSync(GRAPH, 'utf8');
const migration = readFileSync(MIGRATION, 'utf8');
const config = readFileSync(CONFIG, 'utf8');

// ───────────────────────────────────────────────────────────────────────────
describe('Ein Entscheider, nicht zwei', () => {
  it('ruft den gemeinsamen PEP', () => {
    expect(sync).toContain("from '../_shared/pdp/m365event.ts'");
    expect(sync).toContain('await evaluateM365Event(');
  });

  it('ruft den PDP nicht selbst und wertet keinen Snapshot selbst aus', () => {
    // Beides wäre eine zweite Auslegung derselben Regel. Sie liefe auseinander,
    // und die Abweichung fiele erst auf, wenn ein Pfad durchlässt, was der
    // andere meldet.
    expect(sync).not.toContain("_shared/pdp/decide.ts");
    expect(sync).not.toContain('evaluateSnapshot(');
  });

  it('bewertet, bevor es speichert', () => {
    const bewertung = sync.indexOf('await evaluateM365Event(');
    const speichern = sync.indexOf("from('m365_audit_events')");
    expect(bewertung).toBeGreaterThan(-1);
    expect(speichern).toBeGreaterThan(-1);
    expect(bewertung).toBeLessThan(speichern);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Keine Sperre behaupten, die es nicht gab', () => {
  it('schreibt nie ein blockierendes Verdikt', () => {
    // Der CHECK in der Datenbank fängt das ohnehin ab. Diese Prüfung sagt es
    // eine Ebene früher, damit der Fehler nicht erst im Cron-Lauf auffällt.
    expect(sync).not.toMatch(/verdict:\s*'block'/);
    expect(sync).not.toMatch(/verdict:\s*'require_approval'/);
  });

  it('setzt in governance_events kein policy_action', () => {
    // Die Spalte kennt nur allow/log/warn/block/require_approval. Ein 'block'
    // dort behauptete eine Sperre, die nie stattfand.
    const react = sync.slice(sync.indexOf('async function react('), sync.indexOf('async function syncConnection('));
    // Nur Code, keine Kommentare: Der Verzicht auf `policy_action` ist dort
    // begruendet, und die Begruendung nennt das Wort naturgemaess.
    const codeZeilen = react.split('\n').filter((z) => !z.trim().startsWith('//'));
    expect(codeZeilen.join('\n')).not.toMatch(/policy_action:/);
    expect(react).toContain("event_source: 'microsoft365'");
  });

  it('nennt die Klasse in jeder Reaktion', () => {
    expect(sync).toContain("enforcement_class: 'C'");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Das App-Geheimnis verlässt die Serverseite nicht', () => {
  it('taucht in keiner Antwort auf', () => {
    // Zeilenweise geprüft: `credentials_enc` darf nur in Datenbankzugriffen
    // und im Entsiegeln vorkommen, nie in einem `jsonResponse`.
    for (const datei of [connect, sync]) {
      for (const zeile of datei.split('\n')) {
        if (!zeile.includes('credentials_enc')) continue;
        expect(zeile).not.toContain('jsonResponse');
      }
    }
  });

  it('gibt das Klartextgeheimnis nie in den Prüfpfad', () => {
    const audits = connect.split('\n').filter((z) => z.includes('payload:'));
    for (const z of audits) expect(z).not.toContain('client_secret');
    // Stattdessen nur die Tatsache, dass eines gesetzt wurde.
    expect(connect).toContain('secret_set: true');
  });

  it('lehnt ohne Siegel-Schlüssel ab, statt Klartext zu speichern', () => {
    expect(connect).toContain('NO_SEAL_KEY');
    expect(connect).toContain('503');
  });

  it('sperrt die Siegel-Spalte auch per Spaltenrecht', () => {
    expect(migration).toContain('REVOKE SELECT, INSERT, UPDATE ON public.m365_connections FROM authenticated');
    const grant = migration.slice(migration.indexOf('GRANT SELECT (id, tenant_id, azure_tenant_id'));
    const spaltenliste = grant.slice(0, grant.indexOf(')'));
    expect(spaltenliste).not.toContain('credentials_enc');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Graph-Zugriff bleibt bei Microsoft', () => {
  it('spricht nur mit den beiden Microsoft-Hosts', () => {
    // Kommentare vorher entfernen: Seit dem CodeQL-Befund vom 2026-09-05
    // stehen im Modul Beispiel-URLs, die den Angriff erklären
    // (`https://graph.microsoft.com.example.invalid/…`). Sie gehören dorthin —
    // wer die Prüfung ändert, soll lesen können, wogegen sie steht. Der Test
    // meint aber Hosts, die der Code **anspricht**, nicht Hosts, über die er
    // schreibt. Ohne diesen Schnitt bestraft er die eigene Dokumentation.
    const code = graph
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    const hosts = [...code.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
    expect(hosts.length).toBeGreaterThan(0); // sonst prüft der Schnitt nichts mehr
    for (const h of hosts) {
      expect(['https://login.microsoftonline.com', 'https://graph.microsoft.com']).toContain(h);
    }
  });

  it('prüft die Folge-URL der Paginierung, statt ihr zu folgen', () => {
    // `@odata.nextLink` kommt von Microsoft, ist aber eine fremde Angabe. Ohne
    // Prüfung wäre die Paginierung ein Weg, das Token an einen fremden Host zu
    // schicken.
    expect(graph).toContain('Unerwartete Folge-URL');
    expect(graph).toContain('url.startsWith(GRAPH_HOST)');
  });

  it('reicht Microsoft-Fehlertexte nicht ungefiltert weiter', () => {
    // Die Beschreibungen spiegeln regelmässig die gesendeten Werte zurück.
    expect(graph).toContain('j?.error');
    expect(graph).not.toContain('error_description');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Auth-Konfiguration der beiden Functions', () => {
  it('lässt den Abholjob ohne Plattform-JWT laufen und prüft selbst', () => {
    expect(config).toContain('[functions.microsoft365-audit-sync]');
    const block = config.slice(config.indexOf('[functions.microsoft365-audit-sync]'));
    expect(block.slice(0, 60)).toContain('verify_jwt = false');
    // Wer verify_jwt abschaltet, übernimmt die Auth selbst. Ohne diesen Check
    // wäre der Abholjob für jeden im Internet auslösbar.
    expect(sync).toContain('SERVICE_KEY');
    expect(sync).toContain("jsonResponse({ ok: false, error: 'cron only' }, 401)");
  });

  it('lässt die Einrichtungs-Function hinter dem Plattform-JWT', () => {
    // Kein Eintrag in config.toml heisst verify_jwt = true (Default). Zusätzlich
    // owner/admin — wer Anbindungen sieht, darf sie nicht umkonfigurieren.
    expect(config).not.toContain('[functions.microsoft365-connect]');
    expect(connect).toContain("['owner', 'admin']");
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('Die Migration erweitert, sie verengt nicht', () => {
  it('behält alle bisherigen Werte von governance_events.event_source', () => {
    // Eine Erweiterung, die versehentlich einen Bestandswert weglässt, macht
    // jeden künftigen Scanner-Event ungültig — und zwar erst zur Laufzeit.
    for (const alt of [
      'website_scanner', 'browser_extension', 'sdk', 'api',
      'github', 'ci_cd', 'manual', 'agent_runtime',
    ]) {
      expect(migration).toContain(`'${alt}'`);
    }
    expect(migration).toContain("'microsoft365'");
  });

  it('behält alle bisherigen Kanäle von pdp_shadow_log.source', () => {
    for (const alt of [
      'telemetry-ai-event', 'governance-ingest', 'ai-gateway',
      'siteos_publish', 'bot-chat', 'bot-whatsapp', 'bot-voice',
    ]) {
      expect(migration).toContain(`'${alt}'`);
    }
    expect(migration).toContain("'m365-audit'");
  });

  it('sucht den Namen der alten Bedingung, statt ihn zu raten', () => {
    // Die ursprüngliche Bedingung wurde als Spalten-CHECK geschrieben und trägt
    // einen von PostgreSQL vergebenen Namen. Wer daneben liegt, lässt die alte
    // Bedingung stehen — sie weist den neuen Wert weiterhin ab, während die
    // Migration grün durchläuft.
    expect(migration).toContain('pg_get_constraintdef(oid) LIKE');
    expect(migration).toContain('EXECUTE format(');
  });
});
