// .claude/hooks/lib/shell.mjs – gemeinsame Shell-Zerlegung der PreToolUse-Hooks (Phase 3d, 25.11.2026)
// Reine Funktionen, keine Seiteneffekte. Genutzt von guard-bash.mjs.

// Zerlegt eine Shell-Zeile in Teilkommandos (; && || | & Zeilenumbruch) und Wörter, beachtet Quotes.
// Umleitungen (> >> >| < <<< &> N> N>&M) landen nicht in den Wörtern, sondern in `cmd.redirs`.
// Heredoc-Körper werden bewusst als Kommandos weitergeprüft (`bash <<EOF` führt sie aus).
// Rückgabe null = offene Anführungszeichen, nicht sicher prüfbar.
export function split(line) {
  const cmds = [];
  let words = []; let redirs = []; let w = ''; let q = null; let has = false; let pending = null;
  // Befehlswort aus Substitution: `$(echo git) push …` oder `\`echo git\` push …`.
  // Die Wörter nach der schließenden Klammer gehören zu einem Kommando, dessen
  // Befehlswort erst zur Laufzeit feststeht → `dynamic` (Prüfer blockiert).
  let headSubst = 0; let dynamic = false; let inTick = false;
  const atCmdStart = () => words.length === 0 && !has && !pending;
  const endWord = () => {
    if (has) {
      if (pending) { redirs.push({ op: pending, target: w }); pending = null; } else words.push(w);
    }
    w = ''; has = false;
  };
  const endCmd = () => {
    endWord();
    if (pending) { redirs.push({ op: pending, target: '' }); pending = null; }
    if (words.length || redirs.length) {
      const c = words; c.redirs = redirs;
      if (dynamic) { c.dynamic = true; dynamic = false; }
      cmds.push(c);
    }
    words = []; redirs = [];
  };
  const openSubst = () => { if (atCmdStart()) headSubst++; endCmd(); };
  const closeSubst = () => { endCmd(); if (headSubst > 0) { headSubst--; dynamic = true; } };
  const separator = () => { endCmd(); dynamic = false; };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === q) q = null;
      else if (ch === '\\' && q === '"' && i + 1 < line.length) w += line[++i];
      else w += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { q = ch; has = true; continue; }
    if (ch === '\\' && i + 1 < line.length) { w += line[++i]; has = true; continue; }
    if (ch === ' ' || ch === '\t') { endWord(); continue; }
    // Prozess-Substitution <( … ) / >( … ) wie $( … ) als eigenes Kommando behandeln
    if ((ch === '<' || ch === '>') && line[i + 1] === '(') { endCmd(); i++; continue; }
    if (ch === '>' || ch === '<' || (ch === '&' && line[i + 1] === '>')) {
      if (has && /^\d+$/.test(w) && !pending) { w = ''; has = false; } else endWord(); // N> : Dateideskriptor
      let op = ch; i++;
      while (i < line.length && '<>&|'.includes(line[i]) && op.length < 3) {
        if (line[i] === '&' && op.endsWith('>') && /[\d-]/.test(line[i + 1] ?? '')) break; // >&1
        if (line[i] === '|' && op !== '>') break;                                          // Pipe nach <
        op += line[i++];
      }
      if (line[i] === '&' && /[\d-]/.test(line[i + 1] ?? '')) {                          // N>&M, >&-
        i++; while (i < line.length && /[\d-]/.test(line[i])) i++;
        redirs.push({ op: op + '&', target: '' }); i--; continue;
      }
      i--; pending = op; continue;
    }
    if (ch === '\n' || ch === ';' || ch === '|' || ch === '&') { separator(); continue; }
    if (ch === '`') { if (inTick) { inTick = false; closeSubst(); } else { inTick = true; openSubst(); } continue; }
    if (ch === '$' && line[i + 1] === '(') { openSubst(); i++; continue; }
    if (ch === '(') { endCmd(); continue; }
    if (ch === ')') { closeSubst(); continue; }
    w += ch; has = true;
  }
  if (q) return null;
  endCmd();
  return cmds;
}

export const WRAPPERS = new Set(['sudo', 'doas', 'env', 'command', 'exec', 'nohup', 'time', 'xargs', 'nice', 'timeout', 'stdbuf', 'ionice', 'setsid', 'unbuffer', 'chronic']);
const RUNNERS = new Set(['npx', 'bunx', 'pnpx']); // npx <tool> ...
// Shell-Schlüsselwörter vor dem eigentlichen Befehlswort.
const KEYWORDS = new Set(['{', '}', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', 'fi', 'done']);

// Entfernt VAR=wert, Wrapper (sudo, env, timeout 5 …) und Runner (npx, pnpm dlx), liefert das echte Kommando.
export function strip(words) {
  let i = 0;
  let viaStdinArgs = false;
  while (i < words.length) {
    const t = words[i];
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) { i++; continue; }
    if (KEYWORDS.has(t)) { i++; continue; } // { git …; }, if git …; then git …
    if (WRAPPERS.has(t)) {
      if (t === 'xargs') viaStdinArgs = true; // Argumente kommen erst zur Laufzeit aus stdin
      i++;
      while (words[i]?.startsWith('-')) i++;
      if (t === 'timeout' && /^\d/.test(words[i] ?? '')) i++; // timeout 5 <cmd>
      continue;
    }
    break;
  }
  words = words.slice(i);
  if (RUNNERS.has(words[0])) { words = words.slice(1); while (words[0]?.startsWith('-')) words = words.slice(1); }
  if ((words[0] === 'pnpm' || words[0] === 'yarn' || words[0] === 'bun') && (words[1] === 'dlx' || words[1] === 'x')) words = words.slice(2);
  if (viaStdinArgs) words.viaStdinArgs = true;
  return words;
}

/** Enthält ein Wort Laufzeit-Expansion ($VAR, ${…}, $@ …)? Dann ist es nicht statisch prüfbar. */
export const isDynamicWord = (w) => typeof w === 'string' && /\$/.test(w);
