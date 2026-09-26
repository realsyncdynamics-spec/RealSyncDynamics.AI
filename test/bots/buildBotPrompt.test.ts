/**
 * Unit-Tests für buildBotPrompt — die reine Prompt-Bau-Funktion der
 * Bot-Edge-Functions (supabase/functions/_shared/bots.ts).
 *
 * Der `jsr:`-Import in bots.ts ist type-only und wird beim Transpilieren
 * gelöscht; daher lässt sich die Funktion direkt in Vitest importieren.
 */
import { describe, it, expect } from 'vitest';
import { buildBotPrompt } from '../../supabase/functions/_shared/bots';

describe('buildBotPrompt', () => {
  it('enthält immer die neue Nachricht und die Antwort-Aufforderung', () => {
    const out = buildBotPrompt({ userMessage: 'Habt ihr am Samstag offen?' });
    expect(out).toContain('[Neue Nachricht]');
    expect(out).toContain('Nutzer: Habt ihr am Samstag offen?');
    expect(out).toContain('Antworte als Assistent');
    // Ohne Persona/Verlauf keine entsprechenden Abschnitte.
    expect(out).not.toContain('[Unternehmens-Kontext');
    expect(out).not.toContain('[Bisheriger Gesprächsverlauf]');
  });

  it('stellt die Persona voran, wenn vorhanden', () => {
    const out = buildBotPrompt({ persona: 'Du bist der Empfangs-Bot.', userMessage: 'Hallo' });
    expect(out).toContain('[Unternehmens-Kontext und Persona]');
    expect(out).toContain('Du bist der Empfangs-Bot.');
    expect(out.indexOf('[Unternehmens-Kontext und Persona]')).toBeLessThan(out.indexOf('[Neue Nachricht]'));
  });

  it('bindet das Restaurant-Profil als kontrollierten Kontext ein', () => {
    const out = buildBotPrompt({
      config: {
        vertical: 'restaurant',
        restaurant: {
          business_name: 'Pizzeria Bella Napoli',
          order_mode: 'both',
          minimum_order: 15,
          delivery_fee: 2.5,
          estimated_delivery_minutes: 40,
          currency: 'EUR',
        },
      },
      userMessage: 'Ich möchte eine Pizza bestellen.',
    });

    expect(out).toContain('[Branchenprofil]');
    expect(out).toContain('Vertical: Restaurant / Pizza-Service');
    expect(out).toContain('Unternehmen: Pizzeria Bella Napoli');
    expect(out).toContain('Bestellmodus: Lieferung und Abholung');
    expect(out).toContain('Mindestbestellwert: 15.00 EUR');
    expect(out).toContain('Konfigurierte Liefergebühr: 2.50 EUR');
    expect(out).toContain('Lieferzeit-Richtwert: ca. 40 Minuten (nicht verbindlich)');
    expect(out).toContain('Erfinde keine Produkte, Preise, Verfügbarkeiten, Rabatte oder Lieferzeiten.');
    expect(out).toContain('gilt erst nach bestätigtem Backend-Ergebnis als erfolgreich');
  });

  it('ignoriert unbekannte Branchenkonfiguration im Prompt', () => {
    const out = buildBotPrompt({
      config: { vertical: 'unknown', restaurant: { business_name: 'Nicht verwenden' } },
      userMessage: 'Hallo',
    });
    expect(out).not.toContain('[Branchenprofil]');
    expect(out).not.toContain('Nicht verwenden');
  });

  it('rendert den Verlauf mit Nutzer/Assistent-Labels in Reihenfolge', () => {
    const out = buildBotPrompt({
      history: [
        { role: 'user', content: 'Erste Frage' },
        { role: 'assistant', content: 'Erste Antwort' },
      ],
      userMessage: 'Zweite Frage',
    });
    expect(out).toContain('[Bisheriger Gesprächsverlauf]');
    expect(out).toContain('Nutzer: Erste Frage');
    expect(out).toContain('Assistent: Erste Antwort');
    expect(out.indexOf('Erste Frage')).toBeLessThan(out.indexOf('Erste Antwort'));
  });

  it('ignoriert System-Nachrichten und leere Inhalte im Verlauf', () => {
    const out = buildBotPrompt({
      history: [
        { role: 'system', content: 'interne Notiz' },
        { role: 'user', content: '   ' },
        { role: 'assistant', content: 'sichtbar' },
      ],
      userMessage: 'x',
    });
    expect(out).not.toContain('interne Notiz');
    expect(out).toContain('Assistent: sichtbar');
  });

  it('lässt den Verlauf-Block weg, wenn er nach dem Filtern leer ist', () => {
    const out = buildBotPrompt({
      history: [{ role: 'system', content: 'nur system' }],
      userMessage: 'x',
    });
    expect(out).not.toContain('[Bisheriger Gesprächsverlauf]');
  });

  it('trimmt Persona und Nachricht', () => {
    const out = buildBotPrompt({ persona: '  P  ', userMessage: '  M  ' });
    expect(out).toContain('Nutzer: M');
    expect(out).not.toContain('Nutzer:  M');
  });
});
