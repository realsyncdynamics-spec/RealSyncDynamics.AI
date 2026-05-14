import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Compliance guard for Befund 2 of docs/compliance/findings-2026-05-14.md.
//
// `src/lib/pixels.ts` is the SINGLE allowed entry point for any tracker
// pixel (Meta / TikTok / GA4 / Google Ads / LinkedIn / Pinterest). It
// gates injection behind cookie-consent. If any other source file or
// the static `index.html` actually INJECTS a tracker script (via raw
// `<script src="...">`, `<script src={...}>` in JSX, `script.src = …`
// in JS, or `createElement('script')` immediately followed by a src
// assignment) this test fails.
//
// Mock data / documentation strings that merely mention tracker URLs
// without injecting them are intentionally not flagged — see the
// context-sensitive matcher below.
//
// When the gateway grows a new tracker family, add it to the
// TRACKER_HOST_PATTERN table AND to the `lib/pixels.ts` consent-gated
// loader pipeline in the same PR.

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const TRACKER_HOST_PATTERN = /(?:googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|analytics\.tiktok\.com|snap\.licdn\.com|assets\.pinterest\.com|s\.pinimg\.com)/i;

const ALLOWED_RELATIVE_PATHS: ReadonlyArray<string> = [
  // The consent-gated loader. The only legitimate injection site.
  'src/lib/pixels.ts',
];

// Match an *injection vector* + its src attribute / assignment value.
// Three cases:
//   1. HTML / JSX  `<script ... src="<URL>" ...>`
//   2. JS attribute assignment  `script.src = "<URL>"`  (after createElement)
//   3. JS attribute assignment  `.setAttribute('src', "<URL>")`
const INJECTION_MATCHERS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: '<script src="…">',          re: /<script\b[^>]*\bsrc\s*=\s*["'`]([^"'`]+)["'`]/gi },
  { name: 'script.src = "…"',          re: /\bscript(?:Tag)?\.src\s*=\s*["'`]([^"'`]+)["'`]/gi },
  { name: '.setAttribute("src", "…")', re: /\.setAttribute\(\s*["'`]src["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*\)/gi },
];

interface Finding {
  relPath: string;
  matcher: string;
  url: string;
  line: number;
}

function walk(dir: string, out: string[] = [], skip: ReadonlyArray<string>): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (skip.includes(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, out, skip);
    else if (/\.(tsx?|html|jsx|js)$/.test(entry.name)) out.push(abs);
  }
  return out;
}

function lineOf(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) if (content[i] === '\n') line++;
  return line;
}

function scanFiles(): Finding[] {
  const skip = ['node_modules', 'dist', 'coverage', 'services', '.git', 'supabase'];
  const targets = [
    path.join(REPO_ROOT, 'src'),
    path.join(REPO_ROOT, 'index.html'),
  ];

  const files: string[] = [];
  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    const stat = fs.statSync(t);
    if (stat.isDirectory()) walk(t, files, skip);
    else files.push(t);
  }

  const findings: Finding[] = [];
  for (const abs of files) {
    const relPath = path.relative(REPO_ROOT, abs).replace(/\\/g, '/');
    if (ALLOWED_RELATIVE_PATHS.includes(relPath)) continue;
    const content = fs.readFileSync(abs, 'utf-8');

    for (const matcher of INJECTION_MATCHERS) {
      matcher.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = matcher.re.exec(content)) !== null) {
        const url = m[1];
        if (!TRACKER_HOST_PATTERN.test(url)) continue;
        findings.push({
          relPath,
          matcher: matcher.name,
          url,
          line: lineOf(content, m.index),
        });
      }
    }
  }
  return findings;
}

describe('compliance: no raw tracker scripts outside src/lib/pixels.ts', () => {
  it('no source file injects tracker URLs via <script src> / element.src / setAttribute', () => {
    const violations = scanFiles();
    if (violations.length > 0) {
      const lines = violations
        .map((v) => `  - ${v.relPath}:${v.line} (${v.matcher}) → ${v.url}`)
        .join('\n');
      throw new Error(
        `Tracker injection detected outside src/lib/pixels.ts:\n${lines}\n\n` +
        `Either move the injection through pixels.ts (which gates on cookie-consent), ` +
        `or — if this is consent-gated already — add the file path to ALLOWED_RELATIVE_PATHS ` +
        `in this test.`,
      );
    }
    expect(violations).toEqual([]);
  });
});
