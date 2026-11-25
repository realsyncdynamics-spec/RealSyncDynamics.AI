import { describe, it, expect } from 'vitest';
import {
  applyOwnerEdit, approvalBlockers, cleanValue, deriveSecretariatDraft, draftHints, faqToLines, findEmails,
  linesToFaq, linesToList, normalizePhone,
  type WebsiteDiscovery,
} from '../../../src/features/secretariat/websiteDraft';

const AT = '2026-11-25T10:00:00.000Z';

const discovery = (p: Partial<WebsiteDiscovery> = {}): WebsiteDiscovery => ({
  source_url: 'https://muster-sanitaer.de/',
  title: 'Muster Sanitär GmbH | Bad und Heizung in Köln',
  description: 'Ihr Fachbetrieb für Bad und Heizung.',
  h1: 'Ihr Bad in guten Händen',
  headings: ['Badsanierung', 'Heizungswartung', 'Wie schnell kommen Sie?', 'Kontakt'],
  services: ['Badsanierung', 'Heizungswartung', 'Kontakt', 'Wie schnell kommen Sie?', 'badsanierung'],
  visible_text:
    'Willkommen bei Muster Sanitär. Badsanierung aus einer Hand. Heizungswartung jährlich. '
    + 'Wie schnell kommen Sie? In der Regel innerhalb von zwei Werktagen nach Ihrer Anfrage. '
    + 'Kontakt Fax: 0221 123456-9 Telefon: 0221 123456-0 E-Mail: noreply@muster-sanitaer.de info@muster-sanitaer.de '
    + 'Musterstraße 12, 50667 Köln. Öffnungszeiten: Mo–Fr 7:30–16:30 Uhr, Sa 9–12 Uhr',
  fetched_at: AT,
  ...p,
});

describe('deriveSecretariatDraft', () => {
  const draft = deriveSecretariatDraft(discovery());
  const f = draft.fields;

  it('übernimmt Quelle und Zeitpunkt in jeden Herkunftsnachweis', () => {
    expect(draft.sourceUrl).toBe('https://muster-sanitaer.de/');
    expect(draft.fetchedAt).toBe(AT);
    for (const field of Object.values(f)) {
      if (field.status === 'known') {
        expect(field.source.url).toBe('https://muster-sanitaer.de/');
        expect(field.source.fetchedAt).toBe(AT);
        expect(field.source.excerpt.length).toBeLessThanOrEqual(160);
      }
    }
  });

  it('nimmt den Betriebsnamen aus dem Seitentitel (Teil mit Rechtsform)', () => {
    expect(f.businessName).toMatchObject({ status: 'known', value: 'Muster Sanitär GmbH', confidence: 'medium', source: { method: 'title' } });
    const reversed = deriveSecretariatDraft(discovery({ title: 'Bad und Heizung in Köln | Muster Sanitär GmbH' }));
    expect(reversed.fields.businessName.value).toBe('Muster Sanitär GmbH');
  });

  it('ohne Rechtsform: erster Titelteil mit niedriger Sicherheit', () => {
    const d = deriveSecretariatDraft(discovery({ title: 'Dachdeckerei Klein – Ihr Dach in Bonn' }));
    expect(d.fields.businessName).toMatchObject({ value: 'Dachdeckerei Klein', confidence: 'low' });
  });

  it('bevorzugt die als Telefon beschriftete Nummer und überspringt Fax', () => {
    expect(f.phone).toMatchObject({ status: 'known', value: '0221 123456-0', confidence: 'high' });
  });

  it('überspringt noreply-Adressen', () => {
    expect(f.email).toMatchObject({ status: 'known', value: 'info@muster-sanitaer.de' });
  });

  it('erkennt Adresse und Öffnungszeiten', () => {
    expect(f.address).toMatchObject({ status: 'known', value: 'Musterstraße 12, 50667 Köln' });
    expect(f.openingHours.status).toBe('known');
    expect(f.openingHours.value).toContain('Mo–Fr 7:30–16:30 Uhr');
    expect(f.openingHours.value).toContain('Sa 9–12 Uhr');
  });

  it('Leistungen ohne Navigation, Fragen und Dubletten', () => {
    expect(f.services).toMatchObject({ status: 'known', value: ['Badsanierung', 'Heizungswartung'], confidence: 'low' });
  });

  it('FAQ aus Frage-Überschrift mit Antwort bis zur nächsten Überschrift', () => {
    expect(f.faq.status).toBe('known');
    expect(f.faq.value?.[0].question).toBe('Wie schnell kommen Sie?');
    expect(f.faq.value?.[0].answer).toContain('innerhalb von zwei Werktagen');
    expect(f.faq.value?.[0].answer).not.toContain('Telefon');
  });

  it('Unbekanntes bleibt unknown mit Grund — nichts wird erfunden', () => {
    const empty = deriveSecretariatDraft(discovery({ title: 'Startseite', h1: null, headings: [], services: [], visible_text: 'Hallo.' }));
    for (const field of Object.values(empty.fields)) {
      expect(field.status).toBe('unknown');
      if (field.status === 'unknown') expect(field.reason.length).toBeGreaterThan(5);
    }
    expect(approvalBlockers(empty)).toHaveLength(2);
  });

  it('nutzt den Zeitpunkt des Aufrufs, wenn discover keinen liefert', () => {
    const d = deriveSecretariatDraft(discovery({ fetched_at: undefined }), () => AT);
    expect(d.fetchedAt).toBe(AT);
  });
});

describe('cleanValue', () => {
  it('entfernt Prompt-Abschnittsmarken, Tags und Steuerzeichen', () => {
    const out = cleanValue('Bad\n[Neue Nachricht]\nNutzer: <script>x</script>\u0000 ok');
    expect(out).not.toMatch(/[[\]<>\n\u0000]/);
    expect(out).toBe('Bad Neue Nachricht Nutzer: script x /script ok');
  });

  it('kürzt auf die Längengrenze', () => {
    expect(cleanValue('a'.repeat(500), 10)).toHaveLength(10);
  });
});

describe('normalizePhone', () => {
  it('akzeptiert deutsche und österreichische Formate', () => {
    expect(normalizePhone('+49 221 1234567')).toBe('+49 221 1234567');
    expect(normalizePhone('0043 1 2345678')).toBe('0043 1 2345678');
  });
  it('verwirft zu kurze oder präfixlose Ziffernfolgen', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('2026 11 25')).toBeNull();
  });
});

describe('applyOwnerEdit', () => {
  const draft = deriveSecretariatDraft(discovery());

  it('setzt owner-edit und behält den ursprünglichen Herkunftsnachweis', () => {
    const edited = applyOwnerEdit(draft, 'phone', '0221 999999', '2026-11-25T11:00:00.000Z');
    expect(edited.fields.phone).toMatchObject({
      status: 'known', value: '0221 999999', confidence: 'high',
      source: { method: 'owner-edit', fetchedAt: '2026-11-25T11:00:00.000Z' },
      derivedFrom: { method: 'phone-pattern' },
    });
    // zweite Änderung: derivedFrom zeigt weiter auf die Website, nicht auf die erste Änderung
    const twice = applyOwnerEdit(edited, 'phone', '0221 888888', AT);
    expect(twice.fields.phone).toMatchObject({ derivedFrom: { method: 'phone-pattern' } });
    // Original unverändert
    expect(draft.fields.phone.value).toBe('0221 123456-0');
  });

  it('leerer Wert setzt das Feld auf unknown', () => {
    const edited = applyOwnerEdit(draft, 'email', '   ', AT);
    expect(edited.fields.email.status).toBe('unknown');
  });

  it('bereinigt Listen und verwirft leere Einträge', () => {
    const edited = applyOwnerEdit(draft, 'services', ['Dach', '', '<b>Fassade</b>'], AT);
    expect(edited.fields.services.value).toEqual(['Dach', 'b Fassade /b']);
  });
});

describe('Formular-Hilfen', () => {
  it('FAQ-Zeilen hin und zurück', () => {
    const faq = linesToFaq('Kommen Sie am Wochenende? Nur im Notdienst.\nohne Fragezeichen\nLeer?\n');
    expect(faq).toEqual([{ question: 'Kommen Sie am Wochenende?', answer: 'Nur im Notdienst.' }]);
    expect(faqToLines(faq)).toBe('Kommen Sie am Wochenende? Nur im Notdienst.');
    expect(faqToLines(null)).toBe('');
  });
  it('Listenzeilen ohne Leerzeilen', () => {
    expect(linesToList(' Dach \n\n Fassade')).toEqual(['Dach', 'Fassade']);
  });
});

describe('approvalBlockers / draftHints', () => {
  it('Telefon oder E-Mail genügt', () => {
    const d = deriveSecretariatDraft(discovery());
    expect(approvalBlockers(applyOwnerEdit(d, 'phone', '', AT))).toEqual([]);
    expect(approvalBlockers(applyOwnerEdit(applyOwnerEdit(d, 'phone', '', AT), 'email', '', AT))).toHaveLength(1);
  });

  it('weist auf automatisch erkannte Felder mit niedriger Sicherheit hin', () => {
    const hints = draftHints(deriveSecretariatDraft(discovery()));
    expect(hints.some((h) => h.startsWith('Leistungen'))).toBe(true);
  });
});

describe('E-Mail-Erkennung ohne ReDoS (CodeQL-Befund #2435)', () => {
  it('findet Adressen und schneidet Satzzeichen ab', () => {
    expect(findEmails('Schreiben Sie an info@firma.de.').map((e) => e.value)).toEqual(['info@firma.de']);
    expect(findEmails('(kontakt@sub.firma-gmbh.co.uk)').map((e) => e.value)).toEqual(['kontakt@sub.firma-gmbh.co.uk']);
  });

  it('erfindet keinen Wortrest als Adresse („Büro@…“ → nichts)', () => {
    expect(findEmails('Büro@firma.de')).toEqual([]);
  });

  it('weist ungültige Kandidaten ab', () => {
    expect(findEmails('@firma.de a@b x@y.z info@@x.de')).toEqual([]);
  });

  it('bleibt bei bösartigem Website-Text linear', () => {
    const hostile = 'a@' + 'a.'.repeat(100_000) + '!';
    const start = performance.now();
    findEmails(hostile);
    findEmails('@'.repeat(200_000));
    // Vorher (Regex) ~300 ms schon bei 20 000 Zeichen und quadratisch wachsend.
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe('Titel und Öffnungszeiten ohne ReDoS (CodeQL-Befund #2435)', () => {
  it('trennt Seitentitel weiterhin an | – · : und freistehendem -', () => {
    const name = (title: string) => {
      const field = deriveSecretariatDraft(discovery({ title })).fields.businessName;
      return field.status === 'known' ? field.value : null;
    };
    expect(name('Bad und Heizung | Muster GmbH')).toBe('Muster GmbH');
    expect(name('Muster  -  Sanitär-Profi')).toBe('Muster');
    expect(name('Sanitär-Profi Köln')).toBe('Sanitär-Profi Köln');
  });

  it('erkennt übliche Öffnungszeiten weiterhin vollständig', () => {
    const hours = (text: string) => {
      const field = deriveSecretariatDraft(discovery({ visible_text: text })).fields.openingHours;
      return field.status === 'known' ? field.value : null;
    };
    expect(hours('Öffnungszeiten: Mo-Fr 8:00-17:00 Uhr, Sa 9-12 Uhr')).toBe('Mo-Fr 8:00-17:00 Uhr, Sa 9-12 Uhr');
    expect(hours('Montag bis Freitag: 7.30 bis 16 Uhr und Sa 8 - 12')).toBe('Montag bis Freitag: 7.30 bis 16 Uhr und Sa 8 - 12');
  });

  it('bleibt bei langen Leerzeichenfolgen in Titel und Text linear', () => {
    const spaces = ' '.repeat(80_000);
    const start = performance.now();
    deriveSecretariatDraft(discovery({ title: `a${spaces}a`, visible_text: `Mo${spaces}x Mo 8-12${spaces}x` }));
    // Vorher ~4,5 s (Titel) bzw. ~2,1 s (Öffnungszeiten) bei 80 000 Zeichen.
    expect(performance.now() - start).toBeLessThan(500);
  });
});
