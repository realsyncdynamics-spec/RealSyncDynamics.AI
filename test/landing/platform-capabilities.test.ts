/**
 * Wächter: Was die Startseite verspricht, muss ein Backend haben.
 *
 * Ausgangslage (Messung 2026-08-17 gegen RealSyncDynamicsLive): Von 180 Edge
 * Functions im Repository laufen 100 in Produktion. Die Startseite wies
 * `Evidence Vault`, `Policy Engine` und `Provenance` als fertige Module aus —
 * alle drei ohne deploytes Backend.
 *
 * Für ein Produkt, das Nachweisbarkeit verkauft, ist das kein Marketing-Detail:
 * Ein Interessent, der Evidence Vault im Erstgespräch sehen will, findet eine
 * Function, die nie deployt wurde. Diese Tests machen den Weg dorthin schwerer.
 *
 * Sie prüfen **Konsistenz**, nicht den Deployment-Stand selbst — den kann
 * niemand ohne Zugriff auf das Live-Projekt aus einem Unit-Test heraus messen.
 * Was sie erzwingen: Jede öffentlich gezeigte Fähigkeit benennt die Functions,
 * die sie trägt, und diese Functions existieren im Repository. Der Sprung von
 * `'building'` auf `'live'` bleibt eine bewusste, datierte Entscheidung.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLATFORM_CAPABILITIES,
  LIVE_CAPABILITIES,
  BUILDING_CAPABILITIES,
  CAPABILITIES_MEASURED_AT,
} from '@/src/config/platform-capabilities';
import {
  RUNTIME_PREVIEW_LABEL,
  RUNTIME_PREVIEW_NOTE,
  RUNTIME_PREVIEW_CARDS,
} from '@/src/config/landing-runtime-preview';

const FUNCTIONS_DIR = resolve(__dirname, '../../supabase/functions');

describe('Plattform-Fähigkeiten — Behauptung deckt sich mit dem Backend', () => {
  it('jede Fähigkeit benennt mindestens eine tragende Edge Function', () => {
    for (const cap of PLATFORM_CAPABILITIES) {
      expect(cap.backedBy.length, `${cap.name} nennt keine tragende Function`).toBeGreaterThan(0);
    }
  });

  it('jede benannte Edge Function existiert im Repository', () => {
    const missing: string[] = [];
    for (const cap of PLATFORM_CAPABILITIES) {
      for (const fn of cap.backedBy) {
        if (!existsSync(join(FUNCTIONS_DIR, fn, 'index.ts'))) missing.push(`${cap.name} → ${fn}`);
      }
    }
    expect(
      missing,
      'Diese Fähigkeiten verweisen auf Functions, die es nicht gibt. Entweder ist ' +
        'der Name falsch oder die Fähigkeit ist erfunden.',
    ).toEqual([]);
  });

  it('Module in Arbeit tragen eine Begründung', () => {
    for (const cap of BUILDING_CAPABILITIES) {
      expect(
        cap.note,
        `${cap.name} steht auf 'building' ohne Begründung — die Oberfläche zeigt sie an.`,
      ).toBeTruthy();
    }
  });

  it('die gemessenen Lücken stehen nicht auf live', () => {
    // Am 2026-08-17 (zweite Messung, nachmittags) gegen Produktion geprüft:
    // diese Functions sind nicht deployt.
    //
    // Die Liste hat sich am selben Tag geändert — `evidence-vault`,
    // `policy-packs` und `provenance` wurden zwischen den beiden Messungen
    // deployt. Wer hier etwas streicht oder ergänzt, misst vorher gegen
    // `supabase functions list` und zieht CAPABILITIES_MEASURED_AT mit.
    //
    // Grenze des Tests, ausdrücklich: Er kennt nur diese handgepflegte Liste.
    // Eine Function, die niemand hier einträgt, kann unbemerkt auf 'live'
    // stehen — genau so stand „WhatsApp- & Telefonbot" mit 0 von 4 deployten
    // Functions als verfügbar auf der Startseite.
    const notDeployed = [
      'bot-chat', 'bot-voice-webhook', 'appointment-book', 'order-intake',
      'ai-act-auto-classify', 'c2pa-manifest-generate',
    ];
    const wrongly = LIVE_CAPABILITIES
      .filter((cap) => cap.backedBy.some((fn) => notDeployed.includes(fn)))
      .map((cap) => cap.name);

    expect(
      wrongly,
      'Diese Module gelten als live, hängen aber an Functions, die am ' +
        `${CAPABILITIES_MEASURED_AT} nicht in Produktion waren. Vor dem Statuswechsel ` +
        'gegen `supabase functions list` messen und CAPABILITIES_MEASURED_AT mitziehen.',
    ).toEqual([]);
  });

  it('die Startseite rendert aus dieser Quelle, nicht aus einer eigenen Liste', () => {
    const landing = resolve(__dirname, '../../src/pages/MainLanding.tsx');
    const source = readFileSync(landing, 'utf8');
    expect(
      source,
      'MainLanding.tsx importiert die Fähigkeitsquelle nicht — dann kann die ' +
        'Landing wieder Module bewerben, die kein Backend haben.',
    ).toContain('platform-capabilities');
  });

  it('Messdatum ist gesetzt und plausibel', () => {
    expect(CAPABILITIES_MEASURED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('kein Modul in Arbeit steht als Fließtext im öffentlichen Bereich', () => {
    // Der `#platform`-Abschnitt rendert aus der Config und weist 'building'
    // korrekt aus. Die Falle sind die anderen Stellen: Trust-Kacheln,
    // Chip-Reihen, Meta-Descriptions, Absatztexte. Dort stand `Evidence Vault`
    // dreimal und `Policy Engine` einmal als vorhandene Fähigkeit, während
    // beide Backends nicht deployt sind.
    //
    // Ausgenommen ist bewusst das Warteliste-Formular: Ein Modul, für das man
    // sich vormerken lässt, ist dort richtig aufgehoben — das ist die
    // ehrliche Darstellung, nicht der Verstoß.
    const files = [
      'src/pages/MainLanding.tsx',
      'src/components/landing/LandingChannelTools.tsx',
    ];
    const hits: string[] = [];
    for (const rel of files) {
      const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8');
      for (const cap of BUILDING_CAPABILITIES) {
        if (source.includes(cap.name)) hits.push(`${rel} nennt „${cap.name}"`);
      }
    }
    expect(
      hits,
      'Diese Dateien behaupten ein Modul, dessen Backend nicht in Produktion ' +
        'ist. Entweder das Modul auf `live` heben (nach Messung) oder die ' +
        'Stelle auf eine getragene Fähigkeit umschreiben.',
    ).toEqual([]);
  });
});

describe('Erreichbarkeit — fertige Seiten sind von der Startseite aus verlinkt', () => {
  /**
   * CLAUDE.md §14: „Fertiger Code, den niemand erreichen kann, ist
   * verschwendete Arbeit."
   *
   * `/ai-act` und `/sicherheit` existieren, werden prerendert und sind aus
   * der `LandingNavbar` der übrigen öffentlichen Seiten verlinkt — nur die
   * Startseite baut ihre Kopfzeile inline und ließ beide aus. Ein Besucher,
   * der auf `/` landet, fand von dort keinen Weg dorthin.
   *
   * Der Test prüft beide Richtungen: Der Link steht auf der Startseite, und
   * die Route existiert wirklich. Ein Link ins Leere wäre nicht besser als
   * gar keiner.
   */
  const landing = readFileSync(resolve(__dirname, '../../src/pages/MainLanding.tsx'), 'utf8');
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');

  it.each(['/ai-act', '/sicherheit'])('%s ist verlinkt und geroutet', (path) => {
    expect(landing, `Die Startseite verlinkt ${path} nicht.`).toContain(`to="${path}"`);
    expect(app, `${path} hat keine Route — der Link ginge ins Leere.`).toContain(`path="${path}"`);
  });
});

describe('Fachseiten sind von der Startseite aus erreichbar', () => {
  /**
   * Sechs technische Modulseiten liegen unter `src/pages/content/` — jede mit
   * eigener Route, untereinander verlinkt, und von der Startseite aus bislang
   * nicht auffindbar. Genau der Fall aus CLAUDE.md §14: fertiger Text, den
   * niemand erreicht.
   *
   * Geprüft wird beides. Ein Link ohne Route wäre nicht besser als kein Link.
   */
  const app = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
  const withPage = PLATFORM_CAPABILITIES.filter((c) => c.learnMorePath);

  it('mindestens eine Fähigkeit führt auf ihre Fachseite', () => {
    expect(withPage.length).toBeGreaterThan(0);
  });

  it.each(withPage.map((c) => [c.name, c.learnMorePath!] as const))(
    '%s → %s ist geroutet',
    (_name, path) => {
      expect(app, `${path} hat keine Route in App.tsx — der Link ginge ins Leere.`)
        .toContain(`path="${path}"`);
    },
  );

  it('die Startseite rendert die Verweise, statt sie nur zu speichern', () => {
    const landing = readFileSync(resolve(__dirname, '../../src/pages/MainLanding.tsx'), 'utf8');
    expect(
      landing,
      'MainLanding wertet `learnMorePath` nicht aus — dann bleiben die ' +
        'Fachseiten unerreichbar, obwohl die Quelle sie kennt.',
    ).toContain('learnMorePath');
  });
});

describe('Kaufwege für Module ohne Laufzeit tragen einen Hinweis', () => {
  /**
   * Diese Seiten bewerben die Bot-Laufzeit und führen zu Anmeldung oder
   * Checkout. `/pricing/whatsapp` verlinkt direkt auf
   * `/checkout/growth?channel=whatsapp` — und Growth führt das Modul
   * `whatsapp` laut `shared/pricing.ts` als enthaltene Leistung.
   *
   * Solange die vier Bot-Functions nicht deployt sind, kann ein Kunde dort
   * für etwas bezahlen, das keine Nachricht beantwortet. Der Hinweis muss
   * deshalb auf dem Kaufweg stehen, nicht im Kleingedruckten.
   *
   * Nicht in dieser Liste, bewusst: `/ai-dsgvo-bot`. Das ist ein
   * Compliance-Copilot über `ai-gateway`/`ai-invoke` — beide in Produktion.
   * Eine Warnung dort wäre so falsch wie eine fehlende hier.
   */
  const PURCHASE_PATHS = [
    'src/pages/WhatsAppPricingPage.tsx',
    'src/pages/product-entry-points/ChatbotStartPage.tsx',
    'src/pages/product-entry-points/PhonebotStartPage.tsx',
  ];

  const botsCapability = PLATFORM_CAPABILITIES.find((c) => c.id === 'bots');

  it.each(PURCHASE_PATHS)('%s weist den Zustand der Bot-Laufzeit aus', (rel) => {
    if (botsCapability?.status === 'live') return; // Hinweis entfällt zu Recht.
    const source = readFileSync(resolve(__dirname, '../..', rel), 'utf8');
    expect(
      source,
      `${rel} bewirbt die Bot-Laufzeit und führt zu Anmeldung oder Checkout, ` +
        'ohne auszuweisen, dass sie nicht in Produktion ist.',
    ).toContain('CapabilityAvailabilityNotice');
    expect(source).toContain('capabilityId="bots"');
  });

  it('der Hinweis verschwindet durch das Deployment, nicht durch einen Commit', () => {
    const component = readFileSync(
      resolve(__dirname, '../../src/components/landing/CapabilityAvailabilityNotice.tsx'),
      'utf8',
    );
    expect(
      component,
      'Der Hinweis muss sich aus platform-capabilities.ts ableiten. Sonst muss ' +
        'jemand daran denken, ihn zu entfernen — und genau das passiert nicht.',
    ).toContain("status === 'live'");
    expect(component).toContain('PLATFORM_CAPABILITIES');
  });
});

describe('Hero-Panel — Beispiel ist als Beispiel gekennzeichnet', () => {
  const landing = readFileSync(
    resolve(__dirname, '../../src/pages/MainLanding.tsx'),
    'utf8',
  );

  it('das Panel nennt sich nicht mehr „LIVE"', () => {
    // Vorher: Kopfzeile „GOVERNANCE RUNTIME · LIVE", grüner ACTIVE-Punkt,
    // darunter vier hartkodierte Zahlen. Ein anonymer Besucher hat keinen
    // Tenant — dort ist nichts messbar, also darf dort nichts gemessen
    // aussehen (Truth Layer, target-architecture.md §3.1).
    expect(landing).not.toContain('GOVERNANCE RUNTIME · LIVE');
    expect(landing).toContain('RUNTIME_PREVIEW_LABEL');
  });

  it('die Beispielwerte stehen in der Config, nicht in der Seite', () => {
    expect(RUNTIME_PREVIEW_LABEL.toUpperCase()).toContain('BEISPIEL');
    expect(RUNTIME_PREVIEW_NOTE.length).toBeGreaterThan(20);
    // Nur Werte mit Trennzeichen prüfen. Eine blanke `'04'` kollidiert mit der
    // Schrittnummer in GOVERNANCE_STEPS — der Treffer wäre ein Fehlalarm und
    // würde den Wächter unglaubwürdig machen.
    const distinctive = RUNTIME_PREVIEW_CARDS.filter((c) => /[/.,%]/.test(c.value));
    expect(distinctive.length, 'Kein Beispielwert ist eindeutig genug zum Prüfen').toBeGreaterThan(0);
    for (const card of distinctive) {
      expect(
        landing,
        `Der Beispielwert „${card.value}" ist in MainLanding.tsx hartkodiert. ` +
          'Dann kann er ohne den Beispiel-Marker gerendert werden.',
      ).not.toContain(card.value);
    }
  });

  it('die Beispielkarten zeigen nur Module mit deploytem Backend', () => {
    // Ein Beispiel für ein Modul, das es in Produktion nicht gibt, ist auch nur
    // eine Behauptung — nur eine bebilderte.
    //
    // Auf ganze Modulnamen zu prüfen reicht nicht: Die Zeile „WHATSAPP / VOICE"
    // enthält den Namen „WhatsApp- & Telefonbot" nicht und rutschte deshalb
    // durch, obwohl sie genau dieses Modul zeigte. Geprüft wird darum jedes
    // aussagekräftige Wort des Namens einzeln.
    const buildingWords = BUILDING_CAPABILITIES.flatMap((c) =>
      c.name
        .toUpperCase()
        .split(/[^A-ZÄÖÜ0-9]+/)
        .filter((w) => w.length > 3),
    );
    expect(buildingWords.length, 'Keine Wörter zum Prüfen extrahiert').toBeGreaterThan(0);
    for (const card of RUNTIME_PREVIEW_CARDS) {
      const text = `${card.label} ${card.detail ?? ''}`.toUpperCase();
      for (const word of buildingWords) {
        expect(
          text,
          `Die Beispielkarte „${card.label}" zeigt „${word}" — ein Modul ohne Backend in Produktion.`,
        ).not.toContain(word);
      }
    }
  });

  it('keine kumulative Unternehmenskennzahl in den Beispielkarten', () => {
    // „2,1 Mio analysierte Codezeilen", „11.350 behobene Sicherheitsluecken":
    // Solche Werte stehen nicht fuer einen Beispielkunden, sondern fuer
    // RealSyncDynamics selbst. Das ist eine nachpruefbare Tatsachenbehauptung
    // (§5 UWG) und gehoert belegt oder gar nicht — jedenfalls nicht in eine
    // Ansicht, die ausdruecklich als Beispiel ausgewiesen ist.
    const corporate = /\b(mio|mrd|millionen|milliarden|insgesamt|bisher|weltweit)\b/i;
    for (const card of RUNTIME_PREVIEW_CARDS) {
      const text = `${card.label} ${card.value} ${card.detail ?? ''}`;
      expect(
        corporate.test(text),
        `Die Beispielkarte „${card.label}" liest sich wie eine Unternehmenskennzahl: „${text.trim()}".`,
      ).toBe(false);
    }
  });
});
