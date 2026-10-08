/**
 * Infrastruktur-Claims der Startseite (Landing v2, von Landing v4 wiederverwendet).
 *
 * Seit dem 04.10.2026 läuft der Hostinger-VPS (srv1622293) aus; Produktion
 * besteht aus Cloudflare Pages + Supabase. Die Startseite darf den früheren
 * Container-Pfad (VPS · Docker/Traefik · Ollama · Hermes · AnythingLLM ·
 * Uptime Kuma) nicht mehr als laufende Infrastruktur nennen. Kommt der Pfad
 * zurück, wird dieser Test bewusst angepasst — nicht umgangen.
 */
import { describe, expect, it } from 'vitest';
import {
  LV2_EU_NATIVE,
  LV2_FAQ,
  LV2_INFRASTRUCTURE,
  LV2_STACK,
} from '../../src/components/landing/v2/landing-v2-content';

const RETIRED_STACK = /\b(VPS|Docker|Traefik|Ollama|Hermes|AnythingLLM|Uptime Kuma)\b/;

describe('Landing — Infrastruktur nach VPS-Abschaltung', () => {
  it('nennt den VPS-Container-Pfad nirgends als laufende Infrastruktur', () => {
    const texts = [
      ...LV2_STACK,
      ...LV2_EU_NATIVE.flatMap((card) => [card.title, card.text]),
      ...LV2_INFRASTRUCTURE.flatMap((item) => [item.layer, item.title, item.path, item.text]),
      ...LV2_FAQ.flatMap((faq) => [faq.q, faq.a]),
    ];
    const hits = texts.filter((t) => RETIRED_STACK.test(t));
    expect(hits).toEqual([]);
  });

  it('nummeriert die Infrastruktur-Schichten lückenlos', () => {
    const numbers = LV2_INFRASTRUCTURE.map((item) => item.layer.slice(0, 2));
    const expected = LV2_INFRASTRUCTURE.map((_, i) => String(i + 1).padStart(2, '0'));
    expect(numbers).toEqual(expected);
  });
});
