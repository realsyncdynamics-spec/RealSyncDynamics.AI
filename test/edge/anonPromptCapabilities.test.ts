/**
 * Vertrag zwischen dem öffentlichen KI-Mitarbeiter (governance-agent,
 * op 'chat_anon') und dem Produktstatus-Register.
 *
 * Der Anon-Prompt darf Funktionen nur mit dem Status nennen, den
 * src/product/implementation-status.ts belegt. Ändert sich ein Status im
 * Register, schlägt dieser Test fehl, bis der Prompt nachgezogen ist — so
 * kann der Chat nie eine Vorschau als verfügbar oder eine geplante Funktion
 * als nutzbar ausgeben.
 *
 * Die Edge Function ist Deno-Code außerhalb des tsc-Projekts, deshalb wird
 * der Prompt als Text gelesen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IMPLEMENTATION_ITEMS } from '../../src/product/implementation-status';
import { ANON_QUICK } from '../../src/features/governance/AgentWidget/ChatInput';

const root = resolve(__dirname, '../..');
const fnSource = readFileSync(resolve(root, 'supabase/functions/governance-agent/index.ts'), 'utf8');
const appSource = readFileSync(resolve(root, 'src/App.tsx'), 'utf8');
const chatSource = readFileSync(resolve(root, 'src/features/governance/AgentWidget/useAgentChat.ts'), 'utf8');

function anonPrompt(): string {
  const m = fnSource.match(/const ANON_SYSTEM_PROMPT = `([\s\S]*?)`;/);
  if (!m) throw new Error('ANON_SYSTEM_PROMPT nicht gefunden');
  return m[1];
}

const STATUS_LABEL = { live: 'VERFÜGBAR', preview: 'VORSCHAU', 'coming-soon': 'GEPLANT' } as const;

interface CatalogLine { label: string; id: string; text: string }

function catalog(prompt: string): CatalogLine[] {
  const lines: CatalogLine[] = [];
  for (const line of prompt.split('\n')) {
    const m = line.match(/^- \[(VERFÜGBAR|VORSCHAU|GEPLANT)\] (.*) – id:([a-z0-9-]+)\s*$/);
    if (m) lines.push({ label: m[1], text: m[2], id: m[3] });
  }
  return lines;
}

describe('Anon-Prompt: KI-Mitarbeiter', () => {
  const prompt = anonPrompt();
  const lines = catalog(prompt);

  it('hat einen Funktionskatalog', () => {
    expect(lines.length).toBeGreaterThanOrEqual(8);
  });

  it('nennt jede Funktion mit genau dem Status aus implementation-status.ts', () => {
    for (const line of lines) {
      const item = IMPLEMENTATION_ITEMS.find((i) => i.id === line.id);
      expect(item, `Registry-Eintrag fehlt für id:${line.id}`).toBeDefined();
      expect(line.label, `Status-Drift bei id:${line.id}`).toBe(STATUS_LABEL[item!.status]);
    }
  });

  it('enthält keine Funktionszeile ohne Registry-Id', () => {
    const block = prompt.split('FUNKTIONSKATALOG (einzige')[1]?.split('\nLEITPLANKEN')[0] ?? '';
    const bullets = block.split('\n').filter((l) => l.startsWith('- ['));
    expect(bullets.length).toBe(lines.length);
  });

  it('verweist nur auf Routen, die es in App.tsx gibt', () => {
    for (const line of lines) {
      for (const raw of line.text.match(/(?<![\w.])\/[a-z0-9#/-]*/g) ?? []) {
        const path = raw.split('#')[0] || '/';
        expect(appSource, `Route ${path} fehlt (id:${line.id})`).toContain(`path="${path}"`);
      }
    }
  });

  it('nennt keine Preise, keinen Modellanbieter und keine internen Agenten', () => {
    expect(prompt).not.toMatch(/\d+\s*(€|EUR|Euro)/);
    // „Claude“ nur als Teil des Produktnamens „Claude Code Optimizer“ erlaubt.
    expect(prompt).not.toMatch(/\b(Grok|xAI|ATLAS|Anthropic|OpenAI|Gemini)\b/);
    expect(prompt.replace(/Claude Code Optimizer/g, '')).not.toMatch(/\bClaude\b/);
  });

  it('verbietet Ausführungsbestätigungen und eigenmächtige Aktionen', () => {
    expect(prompt).toContain('Du führst nichts aus');
    expect(prompt).toContain('Bestätige nie');
    expect(prompt).toContain('kostenpflichtigen oder sicherheitskritischen');
  });

  it('legt offen, dass es ein KI-System ist (Art. 50 KI-VO) und heißt SYNC', () => {
    expect(prompt).toContain('Du bist ein KI-System');
    expect(prompt.startsWith('Du bist SYNC')).toBe(true);
    expect(prompt).toContain('Versprich keine Rechtskonformität');
  });
});

describe('Anon-Widget: Begrüßung und Einstiege', () => {
  it('begrüßt als digitaler KI-Mitarbeiter', () => {
    expect(chatSource).toContain('Ich bin SYNC, dein digitaler KI-Mitarbeiter von RealSync Dynamics AI.');
    expect(chatSource).not.toContain('öffentliche Compliance-Assistent');
  });

  it('bietet vier Einstiege nach Anliegen', () => {
    expect(ANON_QUICK).toHaveLength(4);
    for (const q of ANON_QUICK) {
      expect(q.label.length).toBeGreaterThan(0);
      expect(q.text.length).toBeGreaterThan(10);
    }
  });
});
