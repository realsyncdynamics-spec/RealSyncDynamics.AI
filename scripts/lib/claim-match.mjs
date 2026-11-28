// AP-0.8 – normalisierter Abgleich für check-landing-claims.mjs (ohne Seiteneffekte, testbar).
// AP-0.8: Abgleich normalisiert (Groß-/Kleinschreibung, Bindestriche, Leerzeichen, &nbsp;),
// damit Schreibvarianten wie „AI Act Compliant“ oder „EU AI Act-konform“ nicht durchrutschen.
// Wortgrenze links; rechts nur deutsche Beugungsendung (konform -> konforme), damit
// „100% EU“ nicht „100% EUR“ trifft. Einzige Ausnahme: eine Verneinung höchstens sechs
// Wörter davor im selben Satz („nicht automatisch DSGVO-konform“), Fragesätze und die
// einzeln begründeten Einträge in LANDING_CLAIM_EXCEPTIONS (implementation-status.ts).
const WORD = 'a-z0-9äöüß';
export function normalizeClaim(text) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/[\s\-\u2010-\u2014_]+/g, ' ')
    .trim();
}
const NEGATION = /(?:^|\s)(nicht|kein|keine|keinen|keiner|ohne|not|no|never|nie)(?:\s|$)/;
export function findClaim(line, phrase) {
  const t = normalizeClaim(line);
  const p = normalizeClaim(phrase);
  if (!p) return null;
  let from = 0;
  for (;;) {
    const i = t.indexOf(p, from);
    if (i < 0) return null;
    from = i + 1;
    if (i > 0 && new RegExp(`[${WORD}]`).test(t[i - 1])) continue;
    const rest = t.slice(i + p.length);
    if (/[a-zäöüß]$/.test(p) ? !new RegExp(`^(?:e[nmrs]?)?(?![${WORD}])`).test(rest) : new RegExp(`^[${WORD}]`).test(rest)) continue;
    const before = t.slice(0, i).split(/[.!?:;•·|]/).pop().trim().split(' ').slice(-6).join(' ');
    if (NEGATION.test(before)) continue;
    // Fragen sind keine Zusicherung („Ist das DSGVO-konform?“); die Antwort wird eigenständig geprüft.
    const end = rest.search(/[.!?]/);
    if (end >= 0 && rest[end] === '?') continue;
    return { index: i };
  }
}


/** Ausnahme greift nur für genau diese Datei und eine Zeile, die den Text enthält. */
export function isException(rel, line, exceptions) {
  const t = normalizeClaim(line);
  return exceptions.find((e) => e.file === rel && t.includes(normalizeClaim(e.text)));
}
