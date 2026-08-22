import { describe, expect, it } from 'vitest';

import {
  ALL_MODULES,
  BOOKABLE_MODULES,
  MODULE_ADDON_PRICE_DIVERGENCE,
  MODULE_PRICING_STATUS,
  OPTIONAL_MODULES,
  PRODUCT_TRACKS,
  REQUIRED_MODULES,
  ADDONS,
  bookableModuleById,
  hasUsageBasedModules,
  isProductTrack,
  modulesForTrack,
  monthlyBaseTotalEur,
  normalizeModuleSelection,
  type BookableModuleId,
} from '../../shared/pricing';

/**
 * Diese Datei sichert die Produktregeln der modularen Product Experience ab.
 *
 * Die wichtigste davon ist keine technische, sondern eine geschäftliche:
 * Compliance muss ohne Frontend-Umbau vollständig nutzbar bleiben. Wer das
 * bricht, bricht das Produktversprechen — deshalb steht sie hier als Test
 * und nicht nur als Kommentar.
 */
describe('Buchbare Module — Struktur', () => {
  it('führt genau ein Pflichtmodul: den Governance Core', () => {
    expect(REQUIRED_MODULES.map((m) => m.id)).toEqual(['governance_core']);
  });

  it('teilt jedes Modul eindeutig in Pflicht oder optional', () => {
    expect(REQUIRED_MODULES.length + OPTIONAL_MODULES.length).toBe(BOOKABLE_MODULES.length);
  });

  it('vergibt jede Modul-ID genau einmal', () => {
    const ids = BOOKABLE_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('verweist mit `unlocks` ausschliesslich auf existierende Fähigkeiten', () => {
    const known = new Set(ALL_MODULES.map((m) => m.id));
    for (const module of BOOKABLE_MODULES) {
      for (const unlocked of module.unlocks) {
        expect(known, `${module.id} → ${unlocked}`).toContain(unlocked);
      }
    }
  });

  it('kennzeichnet jedes Modul mit echten Drittkosten als verbrauchsabhängig', () => {
    // Telefonie, Sprachsynthese und WhatsApp-Konversationen kosten pro
    // Nutzung. Ein Festpreis darauf verkauft bei intensiven Kunden die
    // Marge auf — genau der Fehler, den diese Kennzeichnung verhindert.
    for (const id of ['voice_bot', 'whatsapp_bot', 'website_chat'] as BookableModuleId[]) {
      expect(bookableModuleById(id)?.priceModel, id).toBe('flat_plus_usage');
      expect(bookableModuleById(id)?.usageNote, id).toBeTruthy();
    }
  });

  it('weist die Preise ausdrücklich als provisorisch aus', () => {
    // Solange dieser Wert `provisional` ist, sind die Beträge Testwerte und
    // keine kalkulierten Preise. Der Wechsel auf einen anderen Status ist
    // eine bewusste Entscheidung und muss diesen Test mitziehen.
    expect(MODULE_PRICING_STATUS).toBe('provisional');
  });

  it('benennt die Preisabweichung gegenüber den Plan-Add-ons, statt sie zu verstecken', () => {
    // Voice und WhatsApp existieren doppelt: als Add-on innerhalb der
    // Plan-Leiter und als eigenständiges Modul. Solange beide Preise
    // auseinanderlaufen, muss die Abweichung deklariert sein.
    const addonIds = new Set(ADDONS.map((a) => a.id));
    for (const id of MODULE_ADDON_PRICE_DIVERGENCE) {
      const module = bookableModuleById(id);
      expect(module, id).toBeDefined();
      const twin = id.replace(/_bot$/, '');
      expect(addonIds, `Add-on-Zwilling zu ${id}`).toContain(twin);
      expect(module!.priceEur).not.toBe(ADDONS.find((a) => a.id === twin)!.priceEur);
    }
  });
});

describe('Produktpfade — Compliance ohne Frontend-Umbau', () => {
  it('kennt genau zwei gleichwertige Pfade', () => {
    expect(PRODUCT_TRACKS).toEqual(['keep_frontend', 'modernize_frontend']);
  });

  it('erkennt gültige Pfade und weist alles andere ab', () => {
    expect(isProductTrack('keep_frontend')).toBe(true);
    expect(isProductTrack('modernize_frontend')).toBe(true);
    expect(isProductTrack('scale')).toBe(false);
    expect(isProductTrack(null)).toBe(false);
  });

  it('entzieht dem Pfad ohne Umbau ausschliesslich das AI Frontend', () => {
    // Der Kern des Produktversprechens: Wer sein Frontend behält, verliert
    // genau das Frontend-Modul — nicht Chat, nicht Voice, nicht Buchung.
    const keep = modulesForTrack('keep_frontend').map((m) => m.id);
    const modernize = modulesForTrack('modernize_frontend').map((m) => m.id);
    expect(modernize).toEqual(BOOKABLE_MODULES.map((m) => m.id));
    expect(modernize.filter((id) => !keep.includes(id))).toEqual(['ai_frontend']);
  });

  it('behält den Governance Core in beiden Pfaden', () => {
    for (const track of PRODUCT_TRACKS) {
      expect(modulesForTrack(track).map((m) => m.id)).toContain('governance_core');
    }
  });
});

describe('Modulauswahl und Summe', () => {
  it('ergänzt Pflichtmodule und verwirft Unbekanntes', () => {
    expect(normalizeModuleSelection([])).toEqual(['governance_core']);
    expect(normalizeModuleSelection(['bitte_ignorieren'])).toEqual(['governance_core']);
    expect(normalizeModuleSelection(['booking', 'governance_core'])).toEqual(['governance_core', 'booking']);
  });

  it('liefert eine stabile Reihenfolge unabhängig von der Eingabe', () => {
    expect(normalizeModuleSelection(['booking', 'website_chat'])).toEqual(
      normalizeModuleSelection(['website_chat', 'booking']),
    );
  });

  it('rechnet den Core auch dann mit, wenn er in der Auswahl fehlt', () => {
    const core = bookableModuleById('governance_core')!.priceEur;
    expect(monthlyBaseTotalEur([])).toBe(core);
    expect(monthlyBaseTotalEur(['booking'])).toBe(core + bookableModuleById('booking')!.priceEur);
  });

  it('zählt ein doppelt genanntes Modul nur einmal', () => {
    expect(monthlyBaseTotalEur(['booking', 'booking'])).toBe(monthlyBaseTotalEur(['booking']));
  });

  it('meldet verbrauchsabhängige Anteile, damit keine Endsumme versprochen wird', () => {
    expect(hasUsageBasedModules([])).toBe(false);
    expect(hasUsageBasedModules(['booking'])).toBe(false);
    expect(hasUsageBasedModules(['voice_bot'])).toBe(true);
  });
});
