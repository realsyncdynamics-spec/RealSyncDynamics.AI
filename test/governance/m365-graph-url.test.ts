/**
 * P2-2 — Die Folge-URL von Microsoft Graph darf nirgendwo sonst hinzeigen.
 *
 * ## Der Befund
 *
 * CodeQL meldete am 2026-09-05 „Incomplete URL substring sanitization"
 * (hoch) auf `graph.ts`. Die Prüfung war `url.startsWith(GRAPH_HOST)` —
 * ein Präfixvergleich auf einer Zeichenkette, die ein Angreifer vorne
 * vollständig nachbauen kann.
 *
 * ## Warum das eine echte Lücke war, keine Formalie
 *
 * `graphGet` schickt bei jedem Aufruf das **App-only-Bearer-Token** mit,
 * das mit `AuditLog.Read.All` und `Directory.Read.All` auf den gesamten
 * Microsoft-365-Mandanten des Kunden zugreifen darf. Die URL kommt aus
 * `@odata.nextLink`, also aus einer Antwort — genau deshalb behandelt das
 * Modul sie ausdrücklich als fremde Angabe. Führt die Prüfung an einem
 * fremden Host vorbei, verlässt dieses Token die vertrauenswürdige Zone.
 *
 * Der Test prüft deshalb nicht „wird korrekt geparst", sondern **die
 * Angriffe**: die drei Formen, mit denen sich ein Präfixvergleich
 * überlisten lässt.
 */
import { describe, expect, it } from 'vitest';
import { isGraphUrl } from '../../supabase/functions/_shared/m365/graph.ts';

describe('P2-2 / Ein Präfixvergleich hätte diese URLs durchgelassen', () => {
  it('angehängte Domain — der erlaubte Name steht nur am Anfang', () => {
    // `https://graph.microsoft.com.example.invalid` beginnt buchstäblich mit
    // `https://graph.microsoft.com`. Der Host ist trotzdem fremd.
    expect(isGraphUrl('https://graph.microsoft.com.example.invalid/v1.0/x')).toBe(false);
  });

  it('Benutzer-Anteil — der erlaubte Name steht vor dem @', () => {
    // Alles vor dem `@` ist Benutzername, der echte Host ist example.invalid.
    expect(isGraphUrl('https://graph.microsoft.com@example.invalid/v1.0/x')).toBe(false);
  });

  it('angehängter Pfad auf fremdem Host', () => {
    expect(isGraphUrl('https://example.invalid/https://graph.microsoft.com/v1.0/x')).toBe(false);
  });

  it('Bindestrich-Variante', () => {
    expect(isGraphUrl('https://graph.microsoft.com-example.invalid/v1.0/x')).toBe(false);
  });
});

describe('P2-2 / Was sonst abgewiesen wird', () => {
  it('kein HTTPS — ein Token gehört nie über eine ungesicherte Verbindung', () => {
    expect(isGraphUrl('http://graph.microsoft.com/v1.0/x')).toBe(false);
  });

  it('abweichender Port', () => {
    // Graph antwortet nie auf einem eigenen Port; ein gesetzter deutet auf
    // eine nachgebaute URL.
    expect(isGraphUrl('https://graph.microsoft.com:8443/v1.0/x')).toBe(false);
  });

  it('nicht parsbare Eingabe gilt als nicht erlaubt', () => {
    // Im Zweifel sperren — nicht raten.
    for (const bad of ['', 'nicht-einmal-eine-url', '//graph.microsoft.com/v1.0/x', 'javascript:alert(1)']) {
      expect(isGraphUrl(bad), bad).toBe(false);
    }
  });
});

describe('P2-2 / Echte Graph-URLs bleiben erlaubt', () => {
  it('die normale Folge-URL', () => {
    expect(isGraphUrl('https://graph.microsoft.com/v1.0/auditLogs/directoryAudits?$skiptoken=abc')).toBe(true);
  });

  it('Groß-/Kleinschreibung des Hosts spielt keine Rolle', () => {
    // `URL` normalisiert den Hostnamen — ein Vergleich auf der Rohzeichenkette
    // hätte hier fälschlich gesperrt.
    expect(isGraphUrl('https://GRAPH.MICROSOFT.COM/v1.0/x')).toBe(true);
  });

  it('beta-Pfad und Abfrageparameter', () => {
    expect(isGraphUrl('https://graph.microsoft.com/beta/auditLogs/signIns?$top=50')).toBe(true);
  });
});
