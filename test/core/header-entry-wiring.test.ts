import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

/**
 * Der Kopfzeilen-Einstieg gehört an EINE Entscheidung.
 *
 * Schnitt 2 hat `resolveCustomerDestination` eingeführt, damit ein
 * angemeldeter Bestandskunde nicht in den Einrichtungs-Assistenten
 * zurückfällt. Beim Nachstellen im Browser zeigte sich, dass zwei Seiten
 * ihre Kopfzeile selbst tragen und deshalb an der gemeinsamen Navigation
 * vorbeiliefen — darunter die Startseite, also der Weg mit dem meisten
 * Verkehr. Am Code war das nicht zu sehen: Die geänderten Navbars waren
 * korrekt, sie wurden dort nur nicht verwendet.
 *
 * Diese Prüfung greift deshalb nicht die vier bekannten Dateien ab, sondern
 * das Muster. Eine neue Seite mit eigener Kopfzeile läuft hier auf, bevor
 * sie in Produktion auffällt.
 */
const SRC = resolve(process.cwd(), 'src');

function tsxDateien(dir: string, acc: string[] = []): string[] {
  for (const eintrag of readdirSync(dir)) {
    const pfad = join(dir, eintrag);
    if (statSync(pfad).isDirectory()) tsxDateien(pfad, acc);
    else if (pfad.endsWith('.tsx')) acc.push(pfad);
  }
  return acc;
}

describe('Kopfzeilen-Einstieg', () => {
  it('keine Datei verdrahtet „Login" fest auf /welcome', () => {
    // Nur der Einstiegspunkt selbst: ein Link mit festem Ziel `/welcome`,
    // dessen sichtbarer Text „Login" lautet. Ein Verweis auf /welcome in
    // einem Fließtext ist etwas anderes und bleibt erlaubt.
    const muster = /to="\/welcome"[^>]*>\s*Login\s*</;
    const treffer = tsxDateien(SRC)
      .filter((f) => muster.test(readFileSync(f, 'utf8')))
      .map((f) => relative(process.cwd(), f));

    expect(treffer, 'Kopfzeilen-Login muss über resolveCustomerDestination laufen').toEqual([]);
  });

  it('jede Kopfzeile mit Einstiegspunkt löst ihr Ziel über die gemeinsame Logik auf', () => {
    const kopfzeilen = [
      'src/components/Navbar.tsx',
      'src/components/LandingNavbar.tsx',
      'src/pages/MainLanding.tsx',
      'src/pages/AiGovernancePage.tsx',
    ];
    for (const datei of kopfzeilen) {
      const quelle = readFileSync(resolve(process.cwd(), datei), 'utf8');
      expect(quelle, datei).toContain('resolveCustomerDestination');
      // Beschriftung aus derselben Quelle — sonst behauptet der Knopf eine
      // Anmeldung, während er ins Dashboard führt.
      expect(quelle, datei).toContain('customerEntryLabel');
    }
  });
});
