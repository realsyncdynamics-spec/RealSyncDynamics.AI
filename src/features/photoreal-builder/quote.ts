export const BASE_CENTS = 24900;

/** Was ein Kunde im Kopf hat, bevor er 328 € akzeptiert. */
export const AGENCY_COMPARE = "4.800–12.000 €";

export type FeatureId = "chat" | "phone" | "photos" | "pages" | "hours" | "monitor";

export type RungKey = "launch" | "dialog" | "empfang";
export type AboKey = "starter" | "growth" | "agency";

export type Rung = {
  key: RungKey;
  rung: 1 | 2 | 3;
  name: string;
  cents: number;
  extras: FeatureId[];
  abo: AboKey;
  headline: string;
  want: string;
  includes: string[];
  highlighted?: boolean;
};

/**
 * Der Kunde kauft nicht „Governance“.
 * Er kauft: meine Domain sieht endlich nach Geld aus — und bleibt an.
 *
 * Wann er zahlt: nach der eigenen Vorschau, nicht davor.
 * Was er zahlt als Erstes: Umbau 249 + Betrieb 79 = 328 heute.
 * Chat und Telefon erst, wenn er sie in der Vorschau will.
 */
export const LADDER: Rung[] = [
  {
    key: "launch",
    rung: 1,
    name: "Neue Website",
    cents: 24900,
    abo: "starter",
    extras: [],
    highlighted: true,
    headline: "Ihre Domain. Neue Seite. Sie haben sie vorher gesehen.",
    want: "Ich will diese Seite auf meiner Domain.",
    includes: ["Fotorealistischer Rebuild", "Ihre Texte und Fotos", "Hosting über das Abo"],
  },
  {
    key: "dialog",
    rung: 2,
    name: "Mit Chat",
    cents: 39900,
    abo: "starter",
    extras: ["chat", "hours"],
    headline: "Besucher fragen Öffnungszeiten — der Bot antwortet aus Ihren Daten.",
    want: "Die Seite, plus ein Chat der Bescheid weiß.",
    includes: ["Alles aus Neue Website", "DSGVO-Chat auf der Domain", "Zeiten und Urlaub steuerbar"],
  },
  {
    key: "empfang",
    rung: 3,
    name: "Mit Telefon",
    cents: 64900,
    abo: "growth",
    extras: ["chat", "hours", "phone", "photos", "pages", "monitor"],
    headline: "Wenn niemand rangeht, nimmt der Empfang an. Danach 249 €/M.",
    want: "Chat und Telefon, während ich arbeite.",
    includes: ["Alles aus Mit Chat", "Telefonbot", "Monitoring 90 Tage"],
  },
];

export const RUNTIME: { key: AboKey; name: string; cents: number; blurb: string }[] = [
  { key: "starter", name: "Betrieb", cents: 7900, blurb: "Die Site bleibt an. Evidence 90 Tage." },
  { key: "growth", name: "Empfang live", cents: 24900, blurb: "Telefon bleibt an. 5 Sites." },
  { key: "agency", name: "Kanzlei", cents: 69900, blurb: "Mandanten, Isolation, Audit." },
];

export function rungByKey(key: string | undefined): Rung {
  return LADDER.find((r) => r.key === key) ?? LADDER[0];
}

export function aboByKey(key: string | undefined) {
  return RUNTIME.find((a) => a.key === key) ?? RUNTIME[0];
}

export function aboForRung(rung: RungKey): AboKey {
  return rungByKey(rung).abo;
}

export function monthlyCents(abo: AboKey) {
  return aboByKey(abo).cents;
}

export function firstInvoice(rung: RungKey, abo?: AboKey) {
  const r = rungByKey(rung);
  const a = abo ?? r.abo;
  return r.cents + monthlyCents(a);
}

export function minAboIndex(abo: AboKey) {
  return RUNTIME.findIndex((x) => x.key === abo);
}

export function allowedAbos(rung: RungKey) {
  const min = minAboIndex(aboForRung(rung));
  return RUNTIME.filter((_, i) => i >= min);
}

export function quoteCentsFromRung(key: RungKey) {
  return firstInvoice(key);
}

export function hasExtra(ids: FeatureId[] | undefined, id: FeatureId) {
  return Boolean(ids?.includes(id));
}

export function quoteCents(ids: FeatureId[]) {
  if (ids.includes("phone")) return firstInvoice("empfang");
  if (ids.includes("chat")) return firstInvoice("dialog");
  return firstInvoice("launch");
}

export function quoteLines(ids: FeatureId[]) {
  const key: RungKey = ids.includes("phone") ? "empfang" : ids.includes("chat") ? "dialog" : "launch";
  return [{ id: "today", label: rungByKey(key).name, cents: firstInvoice(key) }];
}

export function isAboKey(key: string): key is AboKey {
  return key === "starter" || key === "growth" || key === "agency";
}
