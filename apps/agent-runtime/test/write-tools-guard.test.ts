/**
 * CI-Guard SEC-05: Schreibende Voice-Tools dürfen in Produktionscode nicht
 * freigeschaltet werden (README „Restrisiko, schreibende Tools gesperrt").
 *
 * Statische Prüfung über den TypeScript-AST aller Dateien unter src/ —
 * Kommentare und Formatierung spielen keine Rolle. Regeln:
 *
 *  R1  `allowWriteTools` (auch ALLOW_WRITE_TOOLS, 'allowWriteTools' als
 *      String/Key) kommt außerhalb von src/voice/tool-gateway.ts nicht vor.
 *  R2  createVoiceToolGateway wird außerhalb von tool-gateway.ts nur direkt
 *      aufgerufen, ohne Alias, mit höchstens einem Objektliteral, das nur
 *      `store` und `env` setzt — kein Spread, kein berechneter Key, keine
 *      Variable als Options-Objekt. Damit fallen auch indirekte Übergaben
 *      (Konfigurationsobjekt, JSON aus Env, 'allow' + 'WriteTools') auf.
 *  R3  In tool-gateway.ts ist die Freigabe festgenagelt: genau eine optionale
 *      boolean-Option, genau ein Lesezugriff `options.allowWriteTools === true`,
 *      der als zweites Argument an createConfiguredGateway geht; kein
 *      anderes Vorkommen (z. B. Env-Schalter, Default true).
 *  R4  Der schreibende Executor (VOICE_TOOL_EXECUTORS / insertAppointment)
 *      wird nur in den dafür vorgesehenen Dateien referenziert — kein
 *      Umweg am Gateway vorbei.
 *
 * Wer eine Regel lockern will, muss diese Datei ändern; das ist Absicht
 * (separate Security-Freigabe).
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));
const GATEWAY_FILE = 'voice/tool-gateway.ts';
const FACTORY = 'createVoiceToolGateway';
const ALLOWED_FACTORY_OPTIONS: ReadonlySet<string> = new Set(['store', 'env']);
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];

/** Bezeichner → Dateien, in denen sie vorkommen dürfen (R4). */
const RESTRICTED_WRITE_PATHS: ReadonlyArray<{ token: string; files: ReadonlySet<string> }> = [
  { token: 'VOICE_TOOL_EXECUTORS', files: new Set(['voice/tool-executors.ts', GATEWAY_FILE]) },
  { token: 'executeScheduleAppointment', files: new Set(['voice/tool-executors.ts']) },
  {
    token: 'insertAppointment',
    files: new Set(['voice/tool-executors.ts', 'voice/voice-store.ts', 'voice/supabase-voice-store.ts']),
  },
];

export interface GuardViolation {
  file: string;
  line: number;
  rule: 'R1' | 'R2' | 'R3' | 'R4';
  message: string;
}

/** allowWriteTools, ALLOW_WRITE_TOOLS, allow-write-tools → 'allowwritetools'. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}
const WRITE_FLAG = normalize('allowWriteTools');

/** Bezeichner und String-artige Literale — alles, worin ein Name stehen kann. */
function tokenText(node: ts.Node): string | undefined {
  if (
    ts.isIdentifier(node) ||
    ts.isPrivateIdentifier(node) ||
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node) ||
    ts.isJsxText(node)
  ) {
    return node.text;
  }
  return undefined;
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child: ts.Node) => walk(child, visit));
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) {
    return name.text;
  }
  return undefined;
}

/** Nur `{ store, env: … }` — R2. */
function checkFactoryOptions(call: ts.CallExpression, report: (n: ts.Node, msg: string) => void): void {
  if (call.arguments.length === 0) return;
  if (call.arguments.length > 1) {
    report(call, `${FACTORY} mit mehr als einem Argument`);
    return;
  }
  const arg = call.arguments[0]!;
  if (!ts.isObjectLiteralExpression(arg)) {
    report(arg, `${FACTORY}: Optionen müssen ein Objektliteral sein (keine Variable / kein Konfigurationsobjekt)`);
    return;
  }
  for (const prop of arg.properties) {
    if (ts.isSpreadAssignment(prop)) {
      report(prop, `${FACTORY}: Spread in den Optionen ist nicht erlaubt`);
      continue;
    }
    if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) {
      report(prop, `${FACTORY}: nur einfache Properties erlaubt`);
      continue;
    }
    const key = propertyNameText(prop.name);
    if (key === undefined) {
      report(prop, `${FACTORY}: berechneter Options-Key ist nicht erlaubt`);
    } else if (!ALLOWED_FACTORY_OPTIONS.has(key)) {
      report(prop, `${FACTORY}: Option '${key}' ist in Produktionscode nicht erlaubt`);
    }
  }
}

/** Erlaubte Verwendung des Factory-Namens außerhalb von tool-gateway.ts — R2. */
function checkFactoryReference(node: ts.Identifier, report: (n: ts.Node, msg: string) => void): void {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) {
    if (parent.propertyName) report(parent, `${FACTORY} darf nicht umbenannt werden`);
    return;
  }
  // Direkter Aufruf: createVoiceToolGateway(…) oder ns.createVoiceToolGateway(…)
  const callee = ts.isPropertyAccessExpression(parent) && parent.name === node ? parent : node;
  const call = callee.parent;
  if (ts.isCallExpression(call) && call.expression === callee) {
    checkFactoryOptions(call, report);
    return;
  }
  report(node, `${FACTORY} darf nur direkt aufgerufen werden (keine Weitergabe als Wert)`);
}

function isWriteFlagToken(node: ts.Node): boolean {
  const text = tokenText(node);
  return text !== undefined && normalize(text).includes(WRITE_FLAG);
}

/** R3: die einzigen erlaubten Vorkommen in tool-gateway.ts. */
function checkGatewayFile(sf: ts.SourceFile, report: (n: ts.Node, msg: string) => void): void {
  let optionSignatures = 0;
  let optionReads = 0;
  let configuredParams = 0;
  let gateUses = 0;

  walk(sf, (node) => {
    // Argumente an createConfiguredGateway: nur `options.allowWriteTools === true`.
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'createConfiguredGateway'
    ) {
      const flag = node.arguments[1];
      if (!flag || flag.getText(sf).replace(/\s+/g, ' ') !== 'options.allowWriteTools === true') {
        report(node, 'createConfiguredGateway: zweites Argument muss `options.allowWriteTools === true` sein');
      }
    }
    if (
      ts.isFunctionDeclaration(node) &&
      node.name?.text === 'createConfiguredGateway' &&
      node.modifiers?.some((m: ts.ModifierLike) => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      report(node, 'createConfiguredGateway darf nicht exportiert werden');
    }

    if (!isWriteFlagToken(node)) return;
    const parent = node.parent;

    if (
      ts.isPropertySignature(parent) &&
      parent.name === node &&
      ts.isInterfaceDeclaration(parent.parent) &&
      parent.parent.name.text === 'VoiceToolGatewayOptions' &&
      parent.questionToken !== undefined &&
      parent.type?.kind === ts.SyntaxKind.BooleanKeyword
    ) {
      optionSignatures += 1;
      return;
    }
    if (
      ts.isPropertyAccessExpression(parent) &&
      parent.name === node &&
      ts.isIdentifier(parent.expression) &&
      parent.expression.text === 'options' &&
      ts.isBinaryExpression(parent.parent) &&
      parent.parent.left === parent &&
      parent.parent.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      parent.parent.right.kind === ts.SyntaxKind.TrueKeyword
    ) {
      optionReads += 1;
      return;
    }
    if (
      ts.isParameter(parent) &&
      parent.name === node &&
      parent.initializer === undefined &&
      parent.type?.kind === ts.SyntaxKind.BooleanKeyword &&
      ts.isFunctionDeclaration(parent.parent) &&
      parent.parent.name?.text === 'createConfiguredGateway'
    ) {
      configuredParams += 1;
      return;
    }
    if (
      ts.isIdentifier(node) &&
      ts.isPrefixUnaryExpression(parent) &&
      parent.operator === ts.SyntaxKind.ExclamationToken
    ) {
      gateUses += 1;
      return;
    }
    report(node, `unerwartetes Vorkommen von '${tokenText(node)}' im Gateway`);
  });

  if (optionSignatures !== 1) report(sf, `erwartet genau eine Option allowWriteTools?: boolean, gefunden ${optionSignatures}`);
  if (optionReads !== 1) report(sf, `erwartet genau einen Lesezugriff options.allowWriteTools === true, gefunden ${optionReads}`);
  if (configuredParams !== 1) report(sf, `erwartet genau einen Parameter allowWriteTools: boolean, gefunden ${configuredParams}`);
  if (gateUses < 1) report(sf, 'Schreibsperre `!allowWriteTools` fehlt');
}

/** Prüft eine Datei; `file` relativ zu src/ mit '/'. */
export function analyzeSource(file: string, text: string): GuardViolation[] {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const violations: GuardViolation[] = [];
  const at = (rule: GuardViolation['rule']) => (node: ts.Node, message: string) => {
    const pos = node === sf ? 0 : node.getStart(sf);
    violations.push({ file, line: sf.getLineAndCharacterOfPosition(pos).line + 1, rule, message });
  };

  if (file === GATEWAY_FILE) {
    checkGatewayFile(sf, at('R3'));
  } else {
    walk(sf, (node) => {
      if (isWriteFlagToken(node)) {
        at('R1')(node, `'${tokenText(node)}' außerhalb von ${GATEWAY_FILE}`);
      }
      const text = tokenText(node);
      if (text === FACTORY) {
        if (ts.isIdentifier(node)) checkFactoryReference(node, at('R2'));
        else at('R2')(node, `${FACTORY} als String (indirekter Zugriff)`);
      }
    });
  }

  walk(sf, (node) => {
    const text = tokenText(node);
    if (text === undefined) return;
    for (const { token, files } of RESTRICTED_WRITE_PATHS) {
      if (text === token && !files.has(file)) {
        at('R4')(node, `${token} außerhalb von ${[...files].join(', ')}`);
      }
    }
  });

  return violations;
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(full));
    else if (SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) out.push(full);
  }
  return out;
}

export function scanProductionSources(srcDir = SRC_DIR): { files: string[]; violations: GuardViolation[] } {
  const files = listSourceFiles(srcDir).map((f) => relative(srcDir, f).split(sep).join('/'));
  const violations = files.flatMap((file) => analyzeSource(file, readFileSync(join(srcDir, file), 'utf8')));
  return { files, violations };
}

function format(violations: GuardViolation[]): string {
  return violations.map((v) => `  src/${v.file}:${v.line} [${v.rule}] ${v.message}`).join('\n');
}

const read = (file: string) => readFileSync(join(SRC_DIR, file), 'utf8');

describe('CI-Guard: schreibende Voice-Tools bleiben in Produktion gesperrt (SEC-05)', () => {
  it('src/ enthält keine Freischaltung', () => {
    const { files, violations } = scanProductionSources();
    // Gegen einen leeren Scan (falscher Pfad) absichern.
    for (const required of ['gateway.ts', 'voice/session-runtime.ts', GATEWAY_FILE]) {
      assert.ok(files.includes(required), `${required} wurde nicht geprüft`);
    }
    assert.deepEqual(violations, [], `Schreib-Freigabe in Produktionscode:\n${format(violations)}`);
  });

  it('erlaubte Aufrufformen und Kommentare schlagen nicht an', () => {
    const src = `
      import { createVoiceToolGateway } from './tool-gateway.js';
      // allowWriteTools bleibt hier ungesetzt (nur Kommentar)
      /* createVoiceToolGateway({ allowWriteTools: true }) */
      const a = createVoiceToolGateway({ store: this.store });
      const b = createVoiceToolGateway({ env: {} });
      const c = createVoiceToolGateway();
      export { createVoiceToolGateway } from './tool-gateway.js';
    `;
    assert.deepEqual(analyzeSource('voice/session-runtime.ts', src), []);
  });
});

describe('CI-Guard Negativtests: künstliche Freischaltung wird erkannt', () => {
  const rulesFor = (file: string, src: string) => analyzeSource(file, src).map((v) => v.rule);

  const cases: Array<{ name: string; file: string; src: string; rule: GuardViolation['rule'] }> = [
    {
      name: 'Literal true in session-runtime.ts',
      file: 'voice/session-runtime.ts',
      src: 'createVoiceToolGateway({ store: this.store, allowWriteTools: true });',
      rule: 'R1',
    },
    {
      name: 'mehrzeilig mit Kommentaren in gateway.ts',
      file: 'gateway.ts',
      src: 'createVoiceToolGateway({\n  store, // Store\n  allowWriteTools /* an */ :\n    true,\n});',
      rule: 'R1',
    },
    {
      name: 'Variable als Wert',
      file: 'gateway.ts',
      src: 'const enabled = true;\ncreateVoiceToolGateway({ store, allowWriteTools: enabled });',
      rule: 'R1',
    },
    {
      name: 'Shorthand aus Env',
      file: 'gateway.ts',
      src: "const allowWriteTools = process.env.X === '1';\ncreateVoiceToolGateway({ store, allowWriteTools });",
      rule: 'R1',
    },
    {
      name: 'Env-Variable ALLOW_WRITE_TOOLS',
      file: 'env.ts',
      src: "export const writeTools = process.env.VOICE_ALLOW_WRITE_TOOLS === '1';",
      rule: 'R1',
    },
    {
      name: 'Key als String / Element-Zugriff',
      file: 'voice/session-runtime.ts',
      src: "const cfg: Record<string, unknown> = { store };\ncfg['allowWriteTools'] = true;",
      rule: 'R1',
    },
    {
      name: 'Konfigurationsobjekt als Variable',
      file: 'gateway.ts',
      src: 'const opts = buildOptions();\ncreateVoiceToolGateway(opts);',
      rule: 'R2',
    },
    {
      name: 'Spread aus JSON-Konfiguration (Name taucht nicht auf)',
      file: 'gateway.ts',
      src: "const extra = JSON.parse(process.env.GW_OPTIONS ?? '{}');\ncreateVoiceToolGateway({ store, ...extra });",
      rule: 'R2',
    },
    {
      name: 'berechneter Key per Konkatenation',
      file: 'gateway.ts',
      src: "createVoiceToolGateway({ store, ['allow' + 'WriteTools']: true });",
      rule: 'R2',
    },
    {
      name: 'unbekannte Option',
      file: 'gateway.ts',
      src: 'createVoiceToolGateway({ store, writeMode: "on" });',
      rule: 'R2',
    },
    {
      name: 'Alias-Import',
      file: 'gateway.ts',
      src: "import { createVoiceToolGateway as make } from './voice/tool-gateway.js';\nmake({ store, ...x });",
      rule: 'R2',
    },
    {
      name: 'Factory als Wert weitergereicht',
      file: 'gateway.ts',
      src: 'const factory = createVoiceToolGateway;\nfactory(opts);',
      rule: 'R2',
    },
    {
      name: 'Namespace-Aufruf mit Variable',
      file: 'gateway.ts',
      src: "import * as tg from './voice/tool-gateway.js';\ntg.createVoiceToolGateway(cfg);",
      rule: 'R2',
    },
    {
      name: 'Factory über String-Zugriff',
      file: 'gateway.ts',
      src: "import * as tg from './voice/tool-gateway.js';\ntg['createVoiceToolGateway'](cfg);",
      rule: 'R2',
    },
    {
      name: 'Executor direkt am Gateway vorbei',
      file: 'voice/session-runtime.ts',
      src: "import { VOICE_TOOL_EXECUTORS } from './tool-gateway.js';\nawait VOICE_TOOL_EXECUTORS.schedule_appointment(ctx);",
      rule: 'R4',
    },
    {
      name: 'Termin direkt in den Store',
      file: 'voice/session-runtime.ts',
      src: 'await this.store.insertAppointment(row);',
      rule: 'R4',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const rules = rulesFor(c.file, c.src);
      assert.ok(rules.includes(c.rule), `erwartet ${c.rule}, gefunden: ${JSON.stringify(rules)}`);
    });
  }

  describe('Manipulation in tool-gateway.ts (R3)', () => {
    const original = read(GATEWAY_FILE);
    const tamper = (from: string | RegExp, to: string) => {
      const changed = original.replace(from, to);
      assert.notEqual(changed, original, `Testvorlage passt nicht mehr: ${String(from)}`);
      return analyzeSource(GATEWAY_FILE, changed).map((v) => v.rule);
    };

    it('unveränderte Datei ist sauber', () => {
      assert.deepEqual(analyzeSource(GATEWAY_FILE, original), []);
    });

    it('Env-Schalter zusätzlich zur Option', () => {
      const rules = tamper(
        'options.allowWriteTools === true)',
        "options.allowWriteTools === true || process.env.VOICE_ALLOW_WRITE_TOOLS === '1')",
      );
      assert.ok(rules.includes('R3'));
    });

    it('Freigabe fest auf true', () => {
      assert.ok(tamper('createConfiguredGateway(store, options.allowWriteTools === true)', 'createConfiguredGateway(store, true)').includes('R3'));
    });

    it('Lesezugriff ohne === true (truthy)', () => {
      assert.ok(tamper('options.allowWriteTools === true', 'Boolean(options.allowWriteTools)').includes('R3'));
    });

    it('Default-Parameter true', () => {
      assert.ok(tamper('allowWriteTools: boolean)', 'allowWriteTools: boolean = true)').includes('R3'));
    });

    it('Option nicht mehr optional/boolean', () => {
      assert.ok(tamper('allowWriteTools?: boolean;', 'allowWriteTools: boolean | string;').includes('R3'));
    });

    it('createConfiguredGateway exportiert', () => {
      assert.ok(tamper('function createConfiguredGateway(', 'export function createConfiguredGateway(').includes('R3'));
    });
  });
});
