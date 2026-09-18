// Kein Verkaufs-CTA darf einen stillgelegten Plan als `tier` mitgeben.
//
// `/contact-sales` liest `tier` und verwertet ihn zweimal (siehe
// `src/pages/ContactSales.tsx`): Die Seitenüberschrift wird daraus gebaut,
// und der Wert geht mit dem Lead an den Server. Ein falscher `tier` ist
// deshalb kein Schönheitsfehler — er begrüßt den Besucher mit dem Namen
// eines Plans, den er nicht mehr kaufen kann, und verbucht seine Anfrage
// unter genau diesem Plan.
//
// Genau das stand auf `/realsync-landing`: Die Karte trug die Überschrift
// „Enterprise", ihr CTA aber `?tier=agency` — ein Rest aus dem AP2-Umbau,
// bei dem die Agency-Karte durch Enterprise ersetzt und der Parameter
// vergessen wurde. Der Angebots-Guard (`check:offer-prices`) konnte das
// nicht sehen: Die Karte nennt keinen Betrag, und geprüft werden Beträge.
//
// Die Liste der stillgelegten Pläne wird aus der SSoT abgeleitet, nicht
// hier gepflegt. Wird ein weiterer Plan auf `availability: 'legacy'`
// gesetzt, deckt diese Prüfung ihn ohne Zutun mit ab.

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { LEGACY_PLANS } from '../../shared/pricing';

const ROOT = resolve(__dirname, '../..');
const SRC = join(ROOT, 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

/** Alle `tier=…`-Werte, die an `/contact-sales` übergeben werden. */
function contactSalesTiers(): { file: string; line: number; tier: string }[] {
  const found: { file: string; line: number; tier: string }[] = [];
  for (const file of sourceFiles(SRC)) {
    readFileSync(file, 'utf-8').split('\n').forEach((text, index) => {
      if (!text.includes('/contact-sales')) return;
      // `tier` kann vor oder hinter anderen Parametern stehen.
      for (const match of text.matchAll(/\/contact-sales\?[^"'`\s]*/g)) {
        const tier = /[?&]tier=([A-Za-z_]+)/.exec(match[0])?.[1];
        if (tier) found.push({ file: relative(ROOT, file), line: index + 1, tier });
      }
    });
  }
  return found;
}

/** Alle `plan=` / `plan_key=`-Werte an `/contact-sales`. */
function contactSalesPlans(): { file: string; line: number; plan: string }[] {
  const found: { file: string; line: number; plan: string }[] = [];
  for (const file of sourceFiles(SRC)) {
    readFileSync(file, 'utf-8').split('\n').forEach((text, index) => {
      if (!text.includes('/contact-sales')) return;
      for (const match of text.matchAll(/\/contact-sales\?[^"'`\s]*/g)) {
        const plan =
          /[?&]plan=([A-Za-z_]+)/.exec(match[0])?.[1] ??
          /[?&]plan_key=([A-Za-z_]+)/.exec(match[0])?.[1];
        if (plan) found.push({ file: relative(ROOT, file), line: index + 1, plan });
      }
    });
  }
  return found;
}

describe('/contact-sales — tier-Parameter', () => {
  it('findet die CTAs überhaupt (sonst prüft der Test nichts)', () => {
    // Ohne diese Zusicherung bliebe der Test auch dann grün, wenn das
    // Suchmuster kaputtgeht und gar nichts mehr gefunden wird.
    expect(contactSalesTiers().length + contactSalesPlans().length).toBeGreaterThan(5);
  });

  it('gibt keinen stillgelegten Plan als tier mit', () => {
    const legacy = new Set(LEGACY_PLANS.map((plan) => plan.id));
    expect(legacy.size, 'SSoT führt keine Legacy-Pläne mehr — Prüfung anpassen').toBeGreaterThan(0);

    const offenders = contactSalesTiers().filter((hit) => legacy.has(hit.tier as never));
    expect(
      offenders.map((o) => `${o.file}:${o.line} → tier=${o.tier}`),
      'Stillgelegter Plan als tier: Der Besucher sieht dessen Namen und die Anfrage wird darunter verbucht.',
    ).toEqual([]);
  });

  it('gibt keinen stillgelegten Plan als plan/plan_key mit (außer explizite Partner-Inquiry)', () => {
    // Partner ist legacy, bleibt aber inquiry-fähig: CTAs dürfen `plan=partner`
    // setzen, damit ContactSales plan_key korrekt verbucht. Andere legacy IDs
    // (falls später) dürfen nicht still reinrutschen.
    const legacy = new Set(LEGACY_PLANS.map((plan) => plan.id));
    const allowedInquiry = new Set(['partner', 'partner_yearly']);
    const offenders = contactSalesPlans().filter(
      (hit) => legacy.has(hit.plan as never) && !allowedInquiry.has(hit.plan),
    );
    expect(
      offenders.map((o) => `${o.file}:${o.line} → plan=${o.plan}`),
    ).toEqual([]);
  });
});
