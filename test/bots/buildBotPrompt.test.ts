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
