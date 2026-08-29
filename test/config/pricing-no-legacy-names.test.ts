import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Qualitätskontrolle: verbotene Plan-Bezeichner dürfen nicht zurückkehren.
 *
 * Das Produkt kennt genau sechs Pläne — Free Audit, Starter, Growth, Agency,
 * Enterprise, Partner. Frühere Parallel-Modelle („Scale", bronze/silver/gold,
 * *_governance) sind entfallen und dürfen nicht erneut auftauchen.
 *
 * Bewusst NICHT geprüft:
 *   - `scale` als CSS-/Tailwind-Begriff (scale-105, transform: scale(), …)
 *   - das Lucide-Icon `Scale` (Waage) — reine Darstellung
 *   - `'scale'` als Antworttyp einer Onboarding-Frage (Skala 1–5)
 *   - Kommentare: sie dokumentieren die Migration und müssen die Altwerte
 *     benennen dürfen. Geprüft wird ausschließlich ausführbarer Code.
 *   - `src/lib/optimizer/`: Bronze/Silber/Gold sind Stufen-Labels des
 *     Claude-Code-Optimizers, keine Abrechnungspläne — sie verweisen bereits
 *     auf die kanonischen planKeys.
 */

const SEARCH_DIRS = ['src', 'shared', 'supabase/functions'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage']);

/** Plan-Bezeichner, die es nicht mehr geben darf. */
const FORBIDDEN: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /['"`]scale(_yearly)?['"`]/g, label: 'Plan-Key "scale"' },
  { pattern: /\bscale_yearly\b/g, label: 'Plan-Key "scale_yearly"' },
  { pattern: /['"`]free_tier['"`]/g, label: 'Plan-Key "free_tier"' },
  { pattern: /\b(starter|professional)_governance\b/g, label: 'Legacy-Governance-Plan' },
  { pattern: /\benterprise_(regulated|public)\b/g, label: 'Legacy-Enterprise-Plan' },
  // Nur in Plan-Kontexten: `silver`/`gold` sind auch Farb-Tokens des
  // Design-Systems (tone="silver"), die hier nichts zu suchen haben.
  { pattern: /\b(plan|tier|planKey|plan_key|PlanLevel)\w*\s*(===?|:)\s*['"`](bronze|silver|gold|platinum)['"`]/gi, label: 'Legacy-Provenance-Plan' },
  { pattern: /['"`](bronze|silver|gold|platinum)['"`]\s*:\s*\[/g, label: 'Legacy-Provenance-Plan-Tabelle' },
];

/**
 * Zeilen, die legitime Ausnahmen enthalten. Absichtlich eng gefasst, damit
 * der Test nicht durch eine zu großzügige Ausnahme wirkungslos wird.
 */
/**
 * Entfernt Kommentare, damit die Prüfung ausführbaren Code bewertet und nicht
 * die Dokumentation der Migration.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/^(\s*)\/\/.*$/gm, '$1');
}

function isAllowed(line: string): boolean {
  // Antworttyp einer Onboarding-Frage (Skala), kein Plan.
  if (line.includes("'yes_no' | 'scale'")) return true;
  // Die Alias-Tabelle der SSoT MUSS die Altwerte nennen — das ist ihr Zweck.
  if (line.includes('LEGACY_PLAN_KEY_ALIASES')) return true;
  if (/^\s*(scale|scale_yearly|free|free_tier):\s*'(partner|partner_yearly|free_audit)',/.test(line)) return true;
  return false;
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectFiles(full, acc);
    } else if (EXTENSIONS.has(extname(full))) {
      acc.push(full);
    }
  }
  return acc;
}

describe('Keine Legacy-Plan-Bezeichner im Quellcode', () => {
  const files = SEARCH_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir)));

  it('findet überhaupt Dateien zum Prüfen', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('enthält keine verbotenen Plan-Bezeichner', () => {
    const violations: string[] = [];

    for (const file of files) {
      // Die generierte Deno-Kopie spiegelt die SSoT inklusive Alias-Tabelle.
      if (file.endsWith('pricing.generated.ts')) continue;

      const relativePath = relative(ROOT, file);
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        if (isAllowed(line)) return;
        for (const { pattern, label } of FORBIDDEN) {
          // Optimizer-Stufen sind Produkt-Labels, keine Abrechnungspläne.
          if (label === 'Legacy-Provenance-Plan' && relativePath.includes('optimizer')) continue;
          pattern.lastIndex = 0;
          if (pattern.test(line)) {
            violations.push(`${relativePath}:${index + 1} — ${label}: ${line.trim()}`);
          }
        }
      });
    }

    expect(violations, `Verbotene Plan-Bezeichner gefunden:\n${violations.join('\n')}`).toEqual([]);
  });
});
