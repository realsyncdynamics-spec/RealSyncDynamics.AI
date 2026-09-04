/**
 * gdpr-audit — ein ungefangener Fehler muss als CORS-fähiges JSON enden.
 *
 * Hintergrund: Vom 2026-08-11 bis 2026-08-30 warf der Handler zur Laufzeit
 * (`runChecks is not defined`). Die Edge-Runtime antwortete mit einer nackten
 * Text-500 ohne Access-Control-Allow-Origin; der Browser verwarf sie bei der
 * CORS-Prüfung, und im UI stand nur „Failed to fetch". Der Top-Level-Catch
 * macht so einen Fehler sichtbar — hier wird geprüft, dass er nicht wieder
 * herausfällt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('supabase/functions/gdpr-audit/index.ts', 'utf8');

describe('gdpr-audit fängt unbehandelte Fehler', () => {
  it('Deno.serve delegiert an handleAudit und fängt alles darunter', () => {
    expect(src).toMatch(/Deno\.serve\(async \(req\) => \{\s*try \{\s*return await handleAudit\(req\);/);
    expect(src).toMatch(/catch \(e\) \{[\s\S]*?jsonError\(500, 'INTERNAL'/);
  });

  it('die Antwort im Fehlerfall geht über jsonError, also mit CORS-Headern', () => {
    const tail = src.slice(src.indexOf('Deno.serve('));
    expect(tail).not.toMatch(/new Response\(/);
  });

  it('der Handler selbst heißt handleAudit und nimmt den Request entgegen', () => {
    expect(src).toContain('async function handleAudit(req: Request): Promise<Response>');
  });
});
