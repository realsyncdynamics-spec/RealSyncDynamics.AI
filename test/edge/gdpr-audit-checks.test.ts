import { describe, it, expect } from 'vitest';
import {
  runChecks,
  extractFacts,
  scoreReport,
  detectTrackers,
  detectConsentBanner,
  hasEqualRejectButton,
  findImpressumLink,
  SEVERITY_WEIGHTS,
  type Issue,
} from '../../supabase/functions/gdpr-audit/checks';
import { evaluateAll } from '../../supabase/functions/_shared/rules/evaluator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tests für die Prüflogik des kostenlosen DSGVO-Audits.
 *
 * Warum diese Datei existiert: `gdpr-audit` rief seit dem 2026-08-19 sechs
 * Funktionen auf, die es nie gab, und antwortete deshalb auf jeden Request
 * mit HTTP 500 — unbemerkt, weil keine Prüfung die Function je aufrief.
 * Diese Tests sorgen dafür, dass ein solcher Ausfall am Schreibtisch
 * auffällt und nicht erst in Produktion.
 *
 * ## Anpassung am 2026-08-31
 *
 * Die Datei stammt aus der Rekonstruktion `2305e3f`. Ihre Struktur und ihre
 * Absichten sind erhalten; angepasst wurden die Erwartungen auf das
 * **gemessene Befund-Vokabular** der 159 historischen Audits
 * (`test/fixtures/gdpr-audit-production-contract.json`).
 *
 * Grund: Die ursprünglichen Erwartungen nagelten Codes fest, die der
 * produktive Scanner nie geliefert hat (`tracking_without_consent`,
 * `no_impressum_link`, `site_unreachable`, `no_clickjacking_protection`).
 * Damit wären Scores vor und nach dem Ausfall unvergleichbar geworden.
 * Entscheid des Eigentümers vom 2026-08-31: Struktur dieser Fassung
 * behalten, Vertrag der Messung wiederherstellen.
 *
 * Die drei Tests zu `usesDynamicGoogleFonts` sind entfallen: Die Regel
 * `GOOGLE_FONTS_EMBEDDED` feuerte in keinem der 159 Audits, der Fakt bleibt
 * bewusst ungesetzt (siehe `checks.ts`), und eine Erkennung ohne Abnehmer
 * wäre toter Code.
 */

const HEADERS = (h: Record<string, string>) => ({
  get: (n: string) => h[n.toLowerCase()] ?? null,
}) as unknown as Headers;

// Eine Seite, die alles richtig macht — Referenz für die Gegenprobe.
const SAUBERE_SEITE = `<!doctype html><html lang="de"><head>
  <meta http-equiv="content-security-policy" content="default-src 'self'">
</head><body>
  <a href="/impressum">Impressum</a>
  <a href="/datenschutz">Datenschutzerklärung</a>
</body></html>`;

const SAUBERE_HEADER = HEADERS({
  'strict-transport-security': 'max-age=31536000',
  'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
  'x-frame-options': 'SAMEORIGIN',
});

describe('Tracker-Erkennung', () => {
  it('findet Google Analytics am Skript-Pfad', () => {
    const html = '<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>';
    expect(detectTrackers(html).keys).toContain('google_analytics');
  });

  it('zählt eine CSP-Allowlist NICHT als Einbindung', () => {
    // Regression-Schutz: Ohne `stripPolicyDeclarations` bekäme ausgerechnet
    // eine gut abgesicherte Seite die meisten Tracker gemeldet.
    const html = `<meta http-equiv="Content-Security-Policy"
      content="script-src https://www.googletagmanager.com/gtag/js">`;
    expect(detectTrackers(html).keys).toHaveLength(0);
  });

  it('zählt einen preconnect-Hint NICHT als Einbindung', () => {
    const html = '<link rel="preconnect" href="https://www.googletagmanager.com/gtag/js">';
    expect(detectTrackers(html).keys).toHaveLength(0);
  });
});

describe('Consent-Banner', () => {
  it('erkennt einen benannten Anbieter', () => {
    expect(detectConsentBanner('<script src="/usercentrics.js"></script>')).toBe(true);
  });

  it('meldet auf einer Seite ohne Banner nichts', () => {
    expect(detectConsentBanner(SAUBERE_SEITE)).toBe(false);
  });

  it('erkennt ein fehlendes Ablehnen als ungleiche Prominenz', () => {
    expect(hasEqualRejectButton('<button>Alle akzeptieren</button>')).toBe(false);
  });

  it('akzeptiert ein gleichwertiges Ablehnen', () => {
    expect(hasEqualRejectButton('<button>Alle akzeptieren</button><button>Alle ablehnen</button>')).toBe(true);
    // Der Alias meldet weiterhin nur Vorkommen — das ist sein Vertrag.
  });
});

describe('Pflichtangaben', () => {
  it('findet das Impressum über den Linktext', () => {
    expect(findImpressumLink('<a href="/rechtliches">Impressum</a>')).toBe('/rechtliches');
  });

  it('findet das Impressum über den Pfad', () => {
    expect(findImpressumLink('<a href="/impressum">Rechtliches</a>')).toBe('/impressum');
  });
});

describe('runChecks', () => {
  it('meldet auf einer sauberen Seite keinen Mangel', () => {
    const issues = runChecks('https://beispiel.de', SAUBERE_SEITE, SAUBERE_HEADER, 200, null);
    const maengel = issues.filter((i) => i.severity !== 'info');
    expect(maengel, `unerwartet: ${maengel.map((i) => i.id).join(', ')}`).toEqual([]);
  });

  it('meldet fehlendes HTTPS als kritisch', () => {
    const issues = runChecks('http://beispiel.de', SAUBERE_SEITE, SAUBERE_HEADER, 200, null);
    expect(issues.find((i) => i.id === 'no_https')?.severity).toBe('critical');
  });

  it('meldet Tracking ohne Einwilligung als kritisch', () => {
    const html = SAUBERE_SEITE + '<script src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>';
    const issues = runChecks('https://beispiel.de', html, SAUBERE_HEADER, 200, null);
    expect(issues.find((i) => i.id === 'tracker_no_consent')?.severity).toBe('critical');
  });

  it('stuft ein fehlendes Impressum außerhalb DE nur als Hinweis ein', () => {
    // § 5 TMG greift nicht weltweit — ein englischsprachiges .com darf dafür
    // keinen schweren Befund bekommen. Der Code unterscheidet sich mit:
    // `no_imprint_link` (DE, critical) gegen `no_imprint_link_non_de` (info).
    const html = '<html lang="en"><body><a href="/privacy">Privacy</a></body></html>';
    const de = runChecks('https://beispiel.de', html.replace('en', 'de'), SAUBERE_HEADER, 200, null);
    const com = runChecks('https://example.com', html, SAUBERE_HEADER, 200, null);
    expect(de.find((i) => i.id === 'no_imprint_link')?.severity).toBe('critical');
    expect(com.find((i) => i.id === 'no_imprint_link_non_de')?.severity).toBe('info');
  });

  it('bricht bei nicht erreichbarer Seite mit einem einzigen Befund ab', () => {
    const issues = runChecks('https://beispiel.de', '', null, null, 'timeout');
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('fetch_failed');
  });

  it('akzeptiert eine CSP aus dem Meta-Tag, aber nicht für Clickjacking', () => {
    // frame-ancestors wird per <meta> vom Browser nicht durchgesetzt.
    const html = `<html lang="de"><head><meta http-equiv="content-security-policy"
      content="default-src 'self'; frame-ancestors 'none'"></head><body>
      <a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></body></html>`;
    const issues = runChecks('https://beispiel.de', html, HEADERS({ 'strict-transport-security': 'max-age=1' }), 200, null);
    expect(issues.some((i) => i.id === 'no_csp')).toBe(false);
    expect(issues.some((i) => i.id === 'no_xframe')).toBe(true);
  });
});

describe('extractFacts', () => {
  const facts = (html = SAUBERE_SEITE, privacyHtml: string | null = null) => extractFacts({
    url: 'https://beispiel.de', html, headers: SAUBERE_HEADER,
    privacyHtml, privacyFound: privacyHtml !== null, imprintFound: true,
  });

  it('liefert genau die Schlüssel, die gdpr.json abfragt', () => {
    // Diese Namen sind der Vertrag mit der Rule Engine. Wird hier einer
    // umbenannt, läuft die zugehörige Regel still ins Leere.
    const f = facts();
    for (const key of [
      'tracker.any_external',
      'tracker.google_analytics.detected',
      'tracker.meta_pixel.detected',
      'consent.banner.detected',
      'consent.banner.reject_button_equal_prominence',
      'consent.detected_before_load',
      'page.impressum.url_found',
      'page.privacy_policy.url_found',
      'page.privacy_policy.mentions_avv',
    ]) {
      expect(f, `Fakt fehlt: ${key}`).toHaveProperty(key);
    }
  });

  it('liefert die Fakten VERSCHACHTELT, nicht als flache Punkt-Schlüssel', () => {
    // Der schwerste Fehler der Vorgaenger-Fassung, und ein stiller:
    // `getFact()` in `_shared/rules/evaluator.ts` zerlegt den Pfad an den
    // Punkten und laeuft durch verschachtelte Objekte. Ein Objekt mit dem
    // FLACHEN Schluessel `'consent.banner.detected'` liefert dort
    // `undefined` — jede Regelbedingung wird falsch, und die gesamte Rule
    // Engine (14 Regeln, DSGVO und AI Act) schweigt, ohne dass etwas bricht.
    //
    // Beleg aus Produktion: Von den 159 historischen Audits trugen 61 einen
    // `rule:`-Befund; die drei Audits vom 2026-08-31 keinen einzigen.
    const f = facts() as Record<string, unknown>;
    expect(f['consent.banner.detected'], 'flacher Schluessel gefunden').toBeUndefined();
    expect((f.consent as Record<string, unknown>).banner).toBeDefined();
  });

  // Die Gegenprobe zum Test darueber: nicht nur die Form der Fakten, sondern
  // ihre Wirkung. Der Test oben faellt auf, wenn jemand flache Punkt-Schluessel
  // zurueckgibt; er faellt NICHT auf, wenn ein Fakt zwar verschachtelt, aber
  // unter falschem Namen oder mit falschem Typ ankommt. Dann schweigt die
  // Regel genauso still.
  //
  // Warum das keine theoretische Sorge ist: Am 2026-09-01 lieferte ein
  // Produktionsscan von realsyncdynamicsai.de keinen einzigen `rule:`-Befund,
  // waehrend derselbe Scan am 2026-08-11 noch AI_ACT_LIMITED_RISK_CHATBOT
  // gemeldet hatte. Die Ursache war harmlos — die Startseite wurde am
  // 2026-08-19 neu gebaut und traegt kein Chat-Widget mehr. Aber das liess
  // sich aus den Tests heraus nicht entscheiden, weil nur eine der drei
  // Regeln eine Wirkungsprobe hatte. Diese Tabelle schliesst die Menge.
  const AUSLOESER: Record<string, () => Record<string, unknown>> = {
    // Banner ohne gleichwertige Ablehnen-Option — 47 von 159 Audits.
    COOKIE_BANNER_DARK_PATTERN: () =>
      facts(SAUBERE_SEITE + '<div class="cookie-banner">Alle akzeptieren</div>') as Record<string, unknown>,
    // Chat-Widget ohne KI-Transparenzhinweis — 14 von 159 Audits.
    AI_ACT_LIMITED_RISK_CHATBOT: () =>
      facts(SAUBERE_SEITE + '<div class="chat-widget">Frag uns etwas</div>') as Record<string, unknown>,
    // Externer Tracker, Datenschutzerklaerung vorhanden, aber ohne AVV — 1 von 159.
    MISSING_AVV_REFERENCE: () =>
      facts(
        SAUBERE_SEITE + '<script src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>',
        '<p>Wir verarbeiten Daten sorgfaeltig.</p>',
      ) as Record<string, unknown>,
  };

  it('deckt jede Regel ab, die in Produktion je gefeuert hat', () => {
    // Fixture-getrieben statt handgepflegt: Kommt ein vierter Regel-Code in
    // `rule_ids_ever_emitted` dazu, schlaegt dieser Test fehl, statt die neue
    // Regel stillschweigend ungeprueft zu lassen.
    const fixture = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/gdpr-audit-production-contract.json'), 'utf8'),
    ) as { rule_ids_ever_emitted: string[] };
    const erwartet = fixture.rule_ids_ever_emitted.map((id) => id.replace(/^rule:/, '')).sort();
    expect(Object.keys(AUSLOESER).sort()).toEqual(erwartet);
  });

  for (const [ruleId, bauen] of Object.entries(AUSLOESER)) {
    it(`laesst die Rule Engine tatsaechlich feuern: ${ruleId}`, () => {
      expect(evaluateAll(bauen()).map((f) => f.rule_id)).toContain(ruleId);
    });
  }

  it('schweigt bei einer mangelfreien Seite', () => {
    // Ohne diese Gegenprobe wuerde ein Evaluator, der einfach alles meldet,
    // die drei Tests darueber ebenfalls bestehen.
    //
    // "Mangelfrei" heisst hier ausdruecklich: mit gelesener
    // Datenschutz-Unterseite. `facts()` ohne zweites Argument setzt
    // `page.privacy_policy.url_found` auf false, und dann feuert
    // MISSING_PRIVACY_POLICY voellig zu Recht.
    //
    // Genau diese Regel erscheint in keinem der 159 historischen Audits —
    // nicht weil sie nie zutraf, sondern weil `RULE_HEURISTIC_OVERLAP` in
    // `checks.ts` sie unterdrueckt, sobald der Heuristik-Befund
    // `no_privacy_link` denselben Mangel bereits meldet. Die Engine sieht
    // ihn, der Bericht zaehlt ihn einmal. Ohne diese Unterdrueckung kostete
    // ein fehlender Pflicht-Link 50 statt 25 Punkte.
    const mangelfrei = facts(
      SAUBERE_SEITE,
      '<p>Wir schliessen einen AVV nach Art. 28 DSGVO.</p>',
    ) as Record<string, unknown>;
    expect(evaluateAll(mangelfrei)).toEqual([]);
  });

  it('unterdrueckt MISSING_PRIVACY_POLICY nicht in der Engine, sondern im Bericht', () => {
    // Die Trennung festgehalten: Die Rule Engine meldet den Mangel,
    // `runChecks` + Overlap-Filter entscheiden, ob er im Bericht landet.
    // Wer den Filter entfernt, sieht den Doppelbefund sofort hier.
    const ohnePrivacy = facts(SAUBERE_SEITE) as Record<string, unknown>;
    expect(evaluateAll(ohnePrivacy).map((f) => f.rule_id)).toContain('MISSING_PRIVACY_POLICY');
  });

  it('übernimmt den AVV-Befund aus der gelesenen Unterseite', () => {
    expect((facts().page as any).privacy_policy.mentions_avv).toBe(false);
    const mitAvv = facts(SAUBERE_SEITE, '<p>Wir schliessen einen AVV nach Art. 28 DSGVO.</p>');
    expect((mitAvv.page as any).privacy_policy.mentions_avv).toBe(true);
  });
});

describe('scoreReport', () => {
  const issue = (severity: Issue['severity']): Issue => ({ id: severity, severity, title: '', detail: '' });

  it('gibt einer mangelfreien Seite 100 Punkte', () => {
    expect(scoreReport([])).toEqual({ score: 100, severity: 'pass' });
  });

  it('lässt Hinweise den Score nicht drücken', () => {
    expect(scoreReport([issue('info'), issue('info')]).score).toBe(100);
  });

  it('drückt einen einzelnen kritischen Befund unter jede grüne Schwelle', () => {
    // Gewicht aus der Messung zurueckgerechnet, nicht gewaehlt: 25 Punkte.
    expect(scoreReport([issue('critical')]).score).toBe(75);
  });

  it('begrenzt den Score bei null', () => {
    expect(scoreReport(Array.from({ length: 9 }, () => issue('critical'))).score).toBe(0);
  });

  it('folgt bei der Einstufung dem schwersten Einzelbefund', () => {
    expect(scoreReport([issue('low'), issue('critical'), issue('medium')]).severity).toBe('critical');
  });

  it('hält die Gewichte in absteigender Schwere', () => {
    expect(SEVERITY_WEIGHTS.critical).toBeGreaterThan(SEVERITY_WEIGHTS.high);
    expect(SEVERITY_WEIGHTS.high).toBeGreaterThan(SEVERITY_WEIGHTS.medium);
    expect(SEVERITY_WEIGHTS.medium).toBeGreaterThan(SEVERITY_WEIGHTS.low);
    expect(SEVERITY_WEIGHTS.info).toBe(0);
  });
});
