/**
 * Regressionsschutz für den wiederhergestellten `/audit`-Scanner.
 *
 * ## Warum diese Datei streng ist
 *
 * `supabase/functions/gdpr-audit/index.ts` rief sechs Funktionen auf, die
 * es nicht gab — im Repository nicht und in Produktion nicht. Jeder Aufruf
 * endete in einem `ReferenceError`, der Endpunkt antwortete mit HTTP 500.
 * Messbar in den Daten: 159 Audits, das neueste vom 2026-08-11, danach
 * nichts. Der Ausfall blieb **achtzehn Tage** unbemerkt, weil kein Test den
 * Vertrag festhielt.
 *
 * Genau das holt diese Datei nach. Sie prüft den rekonstruierten Code gegen
 * `test/fixtures/gdpr-audit-production-contract.json` — den gemessenen
 * Vertrag des produktiven Scanners. Die Fixture wird **nicht** aus dem Code
 * erzeugt; sie stammt aus der Produktionsdatenbank. Der Code richtet sich
 * nach ihr, nicht umgekehrt.
 *
 * ## Was hier nicht geprüft werden kann
 *
 * Ein Replay auf Byte-Ebene. `gdpr_audits` speichert `fetched_html_bytes`
 * (eine Länge), nicht das HTML. Die historischen Seiten haben sich seither
 * geändert; ein erneuter Abruf prüfte die Website von heute, nicht die
 * Rekonstruktion. Belastbar prüfbar ist deshalb der **Vertrag**:
 * Befund-Vokabular, Severity-Semantik, Scoring und Berichtsstruktur.
 * Das steht hier so, damit niemand die Abdeckung für grösser hält als sie ist.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  runChecks,
  scoreReport,
  extractFacts,
  detectTrackers,
  hasConsentBanner,
  findLegalLink,
  deepCheckImprint,
  deepCheckPrivacy,
  isDuplicateOfHeuristic,
  hasPhoneNumber,
  tagsOf,
  attrOf,
  visibleText,
  SEVERITY_WEIGHTS,
  RULE_HEURISTIC_OVERLAP,
  type Issue,
  type IssueSeverity,
} from '../../supabase/functions/gdpr-audit/checks';

const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/gdpr-audit-production-contract.json'), 'utf-8'),
) as {
  severity_weights: Record<IssueSeverity, number>;
  id_severity: Record<string, IssueSeverity>;
  rule_ids_ever_emitted: string[];
  combinations: Array<Record<'critical' | 'high' | 'medium' | 'low' | 'info' | 'score', number> & { severity: string }>;
};

/** Baut eine Befundliste mit der gewünschten Severity-Verteilung. */
function issuesFor(c: { critical: number; high: number; medium: number; low: number; info: number }): Issue[] {
  const out: Issue[] = [];
  const push = (sev: IssueSeverity, n: number) => {
    for (let k = 0; k < n; k++) out.push({ id: `${sev}_${k}`, severity: sev, title: 't', detail: 'd' });
  };
  push('critical', c.critical); push('high', c.high); push('medium', c.medium);
  push('low', c.low); push('info', c.info);
  return out;
}

describe('Scoring — gegen die Produktionsdaten zurückgerechnet', () => {
  it('reproduziert jede der 27 historischen Kombinationen exakt', () => {
    // Kein "ungefähr": Diese Zahlen standen in Kundenberichten.
    for (const c of contract.combinations) {
      const { score, severity } = scoreReport(issuesFor(c));
      expect({ score, severity }, JSON.stringify(c)).toEqual({ score: c.score, severity: c.severity });
    }
  });

  it('hält die Gewichte 25/12/6/2/0 fest', () => {
    expect(SEVERITY_WEIGHTS).toEqual(contract.severity_weights);
  });

  it('lässt info-Befunde den Score nicht drücken', () => {
    // Ein Hinweis, der nichts zu tun gibt, darf nicht wie ein Mangel wiegen.
    const withInfo = scoreReport(issuesFor({ critical: 0, high: 0, medium: 1, low: 0, info: 9 }));
    const without = scoreReport(issuesFor({ critical: 0, high: 0, medium: 1, low: 0, info: 0 }));
    expect(withInfo.score).toBe(without.score);
  });

  it('bleibt bei 0 statt negativ zu werden', () => {
    expect(scoreReport(issuesFor({ critical: 9, high: 0, medium: 0, low: 0, info: 0 })).score).toBe(0);
  });

  it('meldet pass nur bei null Befunden', () => {
    expect(scoreReport([]).severity).toBe('pass');
    expect(scoreReport(issuesFor({ critical: 0, high: 0, medium: 0, low: 0, info: 1 })).severity).toBe('info');
  });
});

describe('Befund-Vokabular — keine erfundenen Codes', () => {
  const known = new Set(Object.keys(contract.id_severity));

  it('emittiert ausschliesslich Codes, die der produktive Scanner geliefert hat', () => {
    // Die Quelle wird gelesen, nicht der Aufruf simuliert: So faellt auch
    // ein Code auf, den nur ein seltener Pfad erzeugt.
    const src = readFileSync(
      resolve(__dirname, '../../supabase/functions/gdpr-audit/checks.ts'), 'utf-8');
    const emitted = [...src.matchAll(/id: '([a-z_0-9]+)'/g)].map((m) => m[1]);
    expect(emitted.length).toBeGreaterThan(20);
    const invented = [...new Set(emitted)].filter((id) => !known.has(id));
    expect(invented, `erfundene Befunde: ${invented.join(', ')}`).toEqual([]);
  });

  it('weist jedem Code dieselbe Severity zu wie in Produktion', () => {
    const cases: Array<[string, () => Issue[]]> = [
      ['fetch_failed', () => runChecks('https://x.de', '', null, null, 'dns')],
      ['no_https', () => runChecks('http://x.de', '<html lang="de"></html>', new Headers(), 200, null)],
    ];
    for (const [id, run] of cases) {
      const found = run().find((i) => i.id === id);
      expect(found, id).toBeDefined();
      expect(found!.severity, id).toBe(contract.id_severity[id]);
    }
  });
});

describe('Doppelbefunde — derselbe Sachverhalt zaehlt einmal', () => {
  it('unterdrueckt genau die Regeln, die in Produktion nie erschienen', () => {
    // rule:MISSING_PRIVACY_POLICY erschien in keinem der 159 Audits — auch
    // nicht in den 18 mit no_privacy_link. Ohne Unterdrueckung kostete der
    // fehlende Link 50 statt 25 Punkte.
    const issues: Issue[] = [{ id: 'no_privacy_link', severity: 'critical', title: 't', detail: 'd' }];
    expect(isDuplicateOfHeuristic('MISSING_PRIVACY_POLICY', issues)).toBe(true);
  });

  it('laesst die drei Regeln durch, die tatsaechlich berichtet wurden', () => {
    const all: Issue[] = Object.keys(contract.id_severity)
      .filter((id) => !id.startsWith('rule:'))
      .map((id) => ({ id, severity: contract.id_severity[id], title: 't', detail: 'd' }));
    for (const ruleId of ['COOKIE_BANNER_DARK_PATTERN', 'AI_ACT_LIMITED_RISK_CHATBOT', 'MISSING_AVV_REFERENCE']) {
      expect(isDuplicateOfHeuristic(ruleId, all), ruleId).toBe(false);
    }
  });

  it('deckt jede unterdrueckte Regel mit einem existierenden Heuristik-Code ab', () => {
    const known = new Set(Object.keys(contract.id_severity));
    for (const [rule, ids] of Object.entries(RULE_HEURISTIC_OVERLAP)) {
      for (const id of ids) expect(known.has(id), `${rule} → ${id}`).toBe(true);
    }
  });
});

describe('Tracker-Erkennung — die 28/100-Regression', () => {
  it('wertet eine CSP-Allowlist nicht als geladenen Tracker', () => {
    // Eine CSP LISTET erlaubte Origins — das ist das Gegenteil eines
    // Verstosses. Genau diese Verwechslung liess frueher jede Seite mit
    // breiter CSP auf ~28/100 fallen und wirkte hartcodiert.
    const html = `<html><head><meta http-equiv="Content-Security-Policy"
      content="script-src 'self' https://www.googletagmanager.com https://connect.facebook.net"></head><body>x</body></html>`;
    expect(detectTrackers(html).names).toEqual([]);
  });

  it('erkennt einen echten Script-Load', () => {
    const html = '<script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script>';
    expect(detectTrackers(html).names).toContain('Google Analytics');
  });

  it('trennt Social-Pixel von uebriger Analytik', () => {
    const html = '<script src="https://analytics.tiktok.com/i18n/pixel/events.js"></script>';
    const d = detectTrackers(html);
    expect(d.socialNames).toContain('TikTok Pixel');
    expect(detectTrackers('<script src="https://static.hotjar.com/c/hotjar-1.js"></script>').socialNames).toEqual([]);
  });

  it('meldet Tracker ohne Banner als kritisch, mit Banner nicht', () => {
    const tracker = '<script src="https://www.googletagmanager.com/gtag/js"></script>';
    const bare = runChecks('https://x.de', `<html lang="de">${tracker}</html>`, new Headers(), 200, null);
    expect(bare.some((i) => i.id === 'tracker_no_consent')).toBe(true);

    const withBanner = runChecks(
      'https://x.de', `<html lang="de">${tracker}<script src="https://cdn.cookiebot.com/uc.js"></script></html>`,
      new Headers(), 200, null);
    expect(withBanner.some((i) => i.id === 'tracker_no_consent')).toBe(false);
  });
});

describe('Jurisdiktion — § 5 TMG gilt nicht weltweit', () => {
  it('meldet ein fehlendes Impressum bei DE-Signalen als kritisch', () => {
    const issues = runChecks('https://beispiel.de', '<html lang="de"><body>Hallo</body></html>', new Headers(), 200, null);
    expect(issues.find((i) => i.id === 'no_imprint_link')?.severity).toBe('critical');
  });

  it('stuft denselben Befund ohne DE-Signale auf info herab', () => {
    const issues = runChecks('https://example.com', '<html lang="en"><body>Hello</body></html>', new Headers(), 200, null);
    expect(issues.some((i) => i.id === 'no_imprint_link')).toBe(false);
    expect(issues.find((i) => i.id === 'no_imprint_link_non_de')?.severity).toBe('info');
  });
});

describe('Pflicht-Links', () => {
  it('findet den Link ueber die Adresse', () => {
    expect(findLegalLink('<a href="/datenschutz">Mehr</a>', 'privacy')).toBe('/datenschutz');
  });

  it('findet ihn auch bei neutraler Adresse ueber den Linktext', () => {
    expect(findLegalLink('<a href="/legal/7">Impressum</a>', 'imprint')).toBe('/legal/7');
  });

  it('meldet nichts, wo nichts ist', () => {
    expect(findLegalLink('<a href="/kontakt">Kontakt</a>', 'privacy')).toBeNull();
  });
});

describe('Abruf fehlgeschlagen — keine Behauptungen ins Blaue', () => {
  it('liefert genau einen Befund und keine Compliance-Aussage', () => {
    const issues = runChecks('https://weg.de', '', null, null, 'dns error');
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('fetch_failed');
    expect(issues[0].detail).toContain('dns error');
  });
});

describe('Unterseiten-Pruefung', () => {
  it('erkennt ein vollstaendiges Impressum als unauffaellig', () => {
    const html = `<html><body>Muster GmbH, Musterstraße 12, 10115 Berlin.
      Telefon: +49 30 1234567, E-Mail: info@muster.de</body></html>`;
    expect(deepCheckImprint(html)).toEqual([]);
  });

  it('meldet fehlende Rechtsform, Anschrift und Kontakt einzeln', () => {
    const ids = deepCheckImprint('<html><body>Über uns</body></html>').map((i) => i.id);
    expect(ids).toContain('sub_imprint_no_legal_form');
    expect(ids).toContain('sub_imprint_no_address');
    expect(ids).toContain('sub_imprint_no_contact');
  });

  it('meldet Drittlandtransfer ohne Rechtsgrundlage', () => {
    const html = '<html><body>Wir übermitteln Daten in die USA.</body></html>';
    expect(deepCheckPrivacy(html).map((i) => i.id)).toContain('sub_privacy_third_country_no_legal_basis');
  });

  it('meldet ihn nicht, wenn SCC genannt sind', () => {
    const html = '<html><body>Übermittlung in die USA auf Basis der Standardvertragsklauseln.</body></html>';
    expect(deepCheckPrivacy(html).map((i) => i.id)).not.toContain('sub_privacy_third_country_no_legal_basis');
  });
});

describe('Fakten-Vertrag zur Rule Engine', () => {
  const facts = (html: string) => extractFacts({
    url: 'https://x.de', html, headers: new Headers(),
    privacyHtml: null, privacyFound: false, imprintFound: false,
  });

  it('bedient die Pfade, die gdpr.json und ai-act.json woertlich lesen', () => {
    const f = facts('<html></html>') as Record<string, any>;
    // Umbenennen schaltet die Regel stumm, ohne dass etwas bricht.
    expect(f.tracker.google_analytics.detected).toBeDefined();
    expect(f.tracker.meta_pixel.detected).toBeDefined();
    expect(f.tracker.any_external).toBeDefined();
    expect(f.consent.banner.detected).toBeDefined();
    expect(f.consent.banner.reject_button_equal_prominence).toBeDefined();
    expect(f.consent.detected_before_load).toBeDefined();
    expect(f.page.privacy_policy.url_found).toBeDefined();
    expect(f.page.privacy_policy.mentions_avv).toBeDefined();
    expect(f.page.impressum.url_found).toBeDefined();
    expect(f.ai_use_case.is_chatbot).toBeDefined();
    expect(f.ai_use_case.disclosure_visible).toBeDefined();
  });

  it('laesst High-Risk- und Prohibited-Fakten ungesetzt', () => {
    // Ob ein Unternehmen KI im Recruiting einsetzt, ist am HTML seiner
    // Startseite nicht beobachtbar. Ein geratener Wert erzeugte einen
    // critical-Befund mit AI-Act-Bezug ohne jede Grundlage.
    const f = facts('<html></html>') as Record<string, any>;
    expect(f.ai_use_case.purpose).toBeUndefined();
    expect(f.ai_use_case.detects_emotion).toBeUndefined();
    expect(f.ai_use_case.actor).toBeUndefined();
    expect(f.ai_use_case.uses_foundation_model_directly).toBeUndefined();
  });

  it('laesst asset.google_fonts.dynamic ungesetzt — benannte Vertragsluecke', () => {
    // GOOGLE_FONTS_EMBEDDED feuerte in keinem der 159 Audits. Den Fakt zu
    // setzen hiesse, fast jedem Bericht einen medium-Befund hinzuzufuegen,
    // den es vorher nicht gab: eine Verschaerfung, getarnt als Recovery.
    const f = facts('<link href="https://fonts.googleapis.com/css?family=Inter">') as Record<string, any>;
    expect(f.asset?.google_fonts?.dynamic).toBeUndefined();
  });

  it('schliesst Einwilligung vor dem Laden aus, wenn es kein Banner gibt', () => {
    const f = facts('<html><body>nichts</body></html>') as Record<string, any>;
    expect(f.consent.banner.detected).toBe(false);
    expect(f.consent.detected_before_load).toBe(false);
    expect(f.consent.banner.reject_button_equal_prominence).toBe(false);
  });

  it('erkennt ein Banner ohne Ablehnen-Option als nicht gleichrangig', () => {
    const f = facts('<div class="cookie-banner">Cookies akzeptieren</div>') as Record<string, any>;
    expect(f.consent.banner.detected).toBe(true);
    expect(f.consent.banner.reject_button_equal_prominence).toBe(false);
  });

  it('erkennt eine gleichrangige Ablehnen-Option', () => {
    const f = facts('<div class="cookie-banner">Alle akzeptieren · Alle ablehnen</div>') as Record<string, any>;
    expect(f.consent.banner.reject_button_equal_prominence).toBe(true);
  });
});

describe('Berichtsstruktur', () => {
  it('gibt jedem Befund die Felder, die Bericht und Teilen-RPC erwarten', () => {
    const issues = runChecks('http://x.de', '<html lang="de"><body>x</body></html>', new Headers(), 200, null);
    expect(issues.length).toBeGreaterThan(0);
    for (const i of issues) {
      expect(typeof i.id).toBe('string');
      expect(typeof i.title).toBe('string');
      expect(typeof i.detail).toBe('string');
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(i.severity);
    }
  });

  it('sichert keine Konformitaet zu', () => {
    // Der Bericht entsteht ohne Mandat und ohne Kenntnis der
    // Verarbeitungsvorgaenge. Dieselbe Sprachregel wie in report.ts.
    const issues = runChecks('https://x.de',
      '<html lang="de"><script src="https://www.googletagmanager.com/gtag/js"></script></html>',
      new Headers(), 200, null);
    const prose = issues.map((i) => `${i.title} ${i.detail}`).join(' ');
    expect(prose).not.toMatch(/ist DSGVO-konform|rechtskonform|garantiert konform/i);
  });
});

describe('Laufzeit auf feindseligem HTML (ReDoS)', () => {
  // Diese Ausdruecke laufen ueber das HTML einer FREMDEN Seite, die ein nicht
  // angemeldeter Besucher benennt. Eine Eingabe, die den Scanner minutenlang
  // bindet, ist eine Denial-of-Service-Luecke — CodeQL hat genau das auf der
  // ersten Fassung als "polynomial ReDoS" gemeldet.
  //
  // Gemessen wird deshalb Laufzeit, nicht nur Korrektheit. Die Schranken sind
  // grosszuegig: Ein quadratischer Ausdruck braucht auf diesen Eingaben
  // Sekunden bis Minuten, ein linearer Millisekunden. Zwischen beidem liegen
  // Groessenordnungen, nicht Messrauschen.
  const BUDGET_MS = 2000;

  function within(label: string, fn: () => void) {
    const t0 = Date.now();
    fn();
    const ms = Date.now() - t0;
    expect(ms, `${label} brauchte ${ms} ms`).toBeLessThan(BUDGET_MS);
  }

  it('haelt bei 60 000 fast-Treffern auf Meta-Tags durch', () => {
    // Der alte Ausdruck `<meta[^>]{0,200}property=["']og:` musste an jeder
    // dieser Fundstellen jede Aufteilung durchprobieren.
    const html = '<meta '.repeat(60_000);
    within('runChecks / meta', () => runChecks('https://x.de', html, new Headers(), 200, null));
  });

  it('haelt bei einer langen Ziffernkette durch', () => {
    // Frueher: \\d{2,5} und \\d{3,} teilten sich dieselbe Kette.
    const text = `Telefon ${'9'.repeat(50_000)}`;
    within('hasPhoneNumber', () => hasPhoneNumber(text));
  });

  it('haelt bei einer langen Buchstabenkette vor einem Strassenwort durch', () => {
    // Frueher: [a-zäöüß.-]{2,30} und die Alternation (str|weg|…) konkurrierten
    // um dieselben Zeichen.
    const html = `<html><body>M${'a'.repeat(50_000)}strasse</body></html>`;
    within('deepCheckImprint', () => deepCheckImprint(html));
  });

  it('haelt bei sehr vielen Ankern durch', () => {
    const html = '<a href="/x">Text</a>'.repeat(20_000);
    within('findLegalLink', () => findLegalLink(html, 'privacy'));
  });

  it('haelt bei einem unabgeschlossenen Anker durch', () => {
    // Kein </a> — der Linktext-Pfad darf daran nicht haengenbleiben.
    const html = `<a href="/legal/7">${'x'.repeat(100_000)}`;
    within('findLegalLink / offen', () => findLegalLink(html, 'imprint'));
  });

  it('haelt bei einer langen Kette ohne @ durch', () => {
    const html = `<html><body>${'a.b+c-'.repeat(20_000)}</body></html>`;
    within('deepCheckPrivacy', () => deepCheckPrivacy(html));
  });
});

describe('Tag-Extraktion', () => {
  it('isoliert Tags und liest Attribute in beiden Anfuehrungsarten', () => {
    expect(tagsOf('<meta property="og:title" content="x">', 'meta')).toHaveLength(1);
    expect(attrOf('<meta property="og:title">', 'property')).toBe('og:title');
    expect(attrOf("<meta property='og:title'>", 'property')).toBe('og:title');
    expect(attrOf('<meta property=og:title>', 'property')).toBe('og:title');
    expect(attrOf('<meta content="x">', 'property')).toBeNull();
  });

  it('verwechselt <a> nicht mit <article>', () => {
    // `\b` nach dem Tag-Namen: sonst zaehlte jedes <article> als Anker.
    expect(tagsOf('<article class="x">', 'a')).toHaveLength(0);
    expect(tagsOf('<a href="/y">', 'a')).toHaveLength(1);
  });
});

describe('Rufnummern-Erkennung', () => {
  it('erkennt uebliche Schreibweisen', () => {
    expect(hasPhoneNumber('+49 30 1234567')).toBe(true);
    expect(hasPhoneNumber('(030) 123-4567')).toBe(true);
  });

  it('haelt Fliesstext mit wenigen Ziffern nicht fuer eine Nummer', () => {
    expect(hasPhoneNumber('Gegruendet 1999 in Berlin, Team von 12 Personen')).toBe(false);
  });
});

describe('Skript-Inhalt zaehlt nicht als Seiteninhalt', () => {
  // CodeQL "Bad HTML filtering regexp": `</script >` ist ein GUELTIGES
  // End-Tag — HTML erlaubt Leerraum vor dem `>`. Der fruehere Ausdruck
  // `<\/script>` traf es nicht, das Element blieb stehen, und der
  // Skript-Inhalt landete im "sichtbaren Text".
  //
  // Fuer einen Compliance-Scanner ist das ein falsch-negativer Befund:
  // Die Seite bekommt "alles in Ordnung" gemeldet, obwohl der Nachweis
  // nur in einem Skript-String steht. Das ist die gefaehrlichste
  // Fehlerrichtung, die dieses Produkt haben kann.

  it('entfernt Skript-Inhalt auch bei "</script >" mit Leerraum', () => {
    const html = '<html><body><script>var x = "geheim";</script >Sichtbar</body></html>';
    const text = visibleText(html);
    expect(text).not.toContain('geheim');
    expect(text).toContain('Sichtbar');
  });

  it('entfernt ihn auch bei "</SCRIPT\t>" und Grossschreibung', () => {
    const html = '<html><body><SCRIPT>var x = "geheim";</SCRIPT\t>Sichtbar</body></html>';
    expect(visibleText(html)).not.toContain('geheim');
  });

  it('schneidet bis Dokumentende, wenn das End-Tag fehlt', () => {
    // So behandelt es auch der Browser: Alles danach ist Skript.
    const html = '<html><body><script>var x = "geheim";';
    expect(visibleText(html)).not.toContain('geheim');
  });

  it('unterdrueckt den Drittland-Befund nicht wegen eines Skript-Strings', () => {
    // Der konkrete Schaden, belegt am 2026-08-30.
    const html = `<html><body>
      <p>Wir uebermitteln Daten in die USA.</p>
      <script>var hinweis = "auf Basis der Standardvertragsklauseln";</script >
    </body></html>`;
    const ids = deepCheckPrivacy(html).map((i) => i.id);
    expect(ids).toContain('sub_privacy_third_country_no_legal_basis');
  });

  it('erfindet keine Telefonnummer aus Ziffern im Skript', () => {
    const html = `<html><body>Muster GmbH, Musterstraße 12, 10115 Berlin
      <script>var tel = "+49 30 1234567";</script ></body></html>`;
    expect(deepCheckImprint(html).map((i) => i.id)).toContain('sub_imprint_no_contact');
  });

  it('entfernt Style-Inhalt genauso', () => {
    expect(visibleText('<style>.a{content:"geheim"}</style >X')).not.toContain('geheim');
  });

  it('laesst echten Inhalt unangetastet', () => {
    expect(visibleText('<p>Hallo <b>Welt</b></p>')).toBe('Hallo Welt');
  });
});
