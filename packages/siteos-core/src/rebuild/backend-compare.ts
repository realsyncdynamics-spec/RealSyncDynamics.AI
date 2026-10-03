// PUBLISH — Vergleich der Backend-Funktionen: Ausgangsseite ↔ Neubau.
//
// Die sichtbare Oberfläche ist der leicht prüfbare Teil einer Umstellung.
// Der gefährliche Teil ist alles, was daran hängt: Formularziele,
// Buchungs- und Zahlungsstrecken, Kundenzugänge, eingebettete Dienste. Eine
// Seite, die schöner ist und ein Anfrageformular verliert, ist ein
// Produktionsausfall (siehe `publish/gate.ts`, `BackendPreservation`).
//
// ## Was „erhalten" hier heißt
//
// Funktion, nicht Adresse. Ein Kontaktformular eines CMS-Plugins sendet an
// einen Endpunkt, der Sitzungs-Token erwartet (Contact Form 7, WPForms …);
// dieselbe Adresse aus einer statischen Seite anzusprechen, sähe erhalten
// aus und liefe ins Leere. Erhalten ist ein Anfrageweg deshalb, wenn der
// Neubau ein sichtbares Formular mit **eingetragenem** Ziel (https oder
// mailto) hat — ein Ziel, das eine Person bewusst gesetzt hat.
//
// Buchungs- und Zahlungsstrecken bei Drittanbietern sind erhalten, wenn der
// Neubau dorthin verlinkt. Strecken auf der bisherigen Website selbst
// (`/shop`, `/checkout`) gelten als verloren: Nach dem Umzug gäbe es sie
// nicht mehr, solange niemand eine eigenständige Adresse dafür einträgt.
//
// ## Bewusster Verzicht
//
// Nicht jede Funktion soll mit umziehen (ein alter Newsletter, eine
// verwaiste Suche). Ein Verzicht ist eine Zurechnung wie eine Freigabe (G4):
// Person, Zeitpunkt, Begründung — serverseitig gespeichert, im Prüfpfad
// sichtbar, als Hinweis in jeder Bewertung. Er sperrt dann nicht mehr.
//
// ## Grenzen, benannt statt verschwiegen
//
// Gelesen werden Formulare, Links und Einbettungen der abgerufenen Seiten.
// Was per Skript nachgeladen wird, ist so nicht sichtbar, und Unterseiten
// jenseits des Abruflimits sind nicht geprüft. Beides steht in `unverified`
// — der Publish Gate verlangt dafür eine Freigabe statt einer stillen
// Zusage.

import { isDeliverableFormTarget } from '../analysis/blueprint.ts';
import { canonicalHash } from '../canonical.ts';
import type { BackendComparison } from '../publish/gate.ts';
import type { SiteBlock, SiteBlueprint } from '../types.ts';
import { baseDomain, sameSite } from './hosts.ts';
import type { SourceForm, SourceSnapshot, ThirdPartyResource } from './types.ts';

export type BackendItemKind = 'form-target' | 'payment' | 'booking' | 'api' | 'tracking' | 'embed';

export interface BackendItem {
  /** Stabil je Funktion der Quelle — Schlüssel für einen bewussten Verzicht. */
  key: string;
  kind: BackendItemKind;
  label: string;
  /** Ziel bzw. Adresse auf der Ausgangsseite. */
  source: string;
  evidence: string[];
  /**
   * `preserved`: im Neubau erhalten · `lost`: fehlt, sperrt die
   * Veröffentlichung · `waived`: bewusst entfallen (mit Begründung) ·
   * `info`: entfällt, ohne Produktionsfunktion zu sein (Tracking, Video).
   */
  status: 'preserved' | 'lost' | 'waived' | 'info';
  /** Wie die Funktion erhalten ist — oder was zu tun ist. */
  detail: string;
  /** Kann ein Verzicht erklärt werden? (nur für `lost`) */
  waivable: boolean;
}

export interface BackendWaiver {
  key: string;
  reason: string;
  /** Nutzer-ID der Person, die verzichtet hat. */
  by: string;
  at: string;
}

export interface BackendReport {
  items: BackendItem[];
  /** Eingabe für den Publish Gate. */
  comparison: BackendComparison;
  /** Umfang der Prüfung in Sätzen. */
  coverage: string[];
}

const FORM_KIND: Readonly<Record<SourceForm['purpose'], BackendItemKind | null>> = {
  contact: 'form-target',
  newsletter: 'form-target',
  booking: 'booking',
  order: 'payment',
  login: 'api',
  other: 'api',
  search: null,
};

const FORM_LABEL: Readonly<Record<SourceForm['purpose'], string>> = {
  contact: 'Anfrageformular',
  newsletter: 'Newsletter-Anmeldung',
  booking: 'Terminformular',
  order: 'Bestellformular',
  login: 'Kundenzugang (Login)',
  other: 'Formular',
  search: 'Suche',
};

/**
 * Vergleicht die Backend-Funktionen der Ausgangsseite mit dem Neubau.
 * Rein und deterministisch — läuft im Publish Gate serverseitig auf dem
 * gespeicherten Snapshot, nie auf Angaben des Aufrufers.
 */
export function compareBackend(snapshot: SourceSnapshot, blueprint: SiteBlueprint, waivers: BackendWaiver[] = []): BackendReport {
  const items: BackendItem[] = [];
  const links = collectLinks(blueprint);
  const forms = visibleForms(blueprint);
  const configured = forms.filter((f) => isDeliverableFormTarget(f.content.target));
  const host = snapshot.host;

  // ── Formulare ───────────────────────────────────────────────────────
  const seenForms = new Set<string>();
  for (const page of snapshot.pages) {
    for (const form of page.forms) {
      const kind = FORM_KIND[form.purpose];
      const target = form.action ?? page.url;
      const key = `form:${form.purpose}:${normalizeTarget(target)}`;
      if (seenForms.has(key)) continue;
      seenForms.add(key);
      const label = FORM_LABEL[form.purpose];

      if (kind === null) {
        items.push({
          key, kind: 'embed', label, source: target, evidence: [form.ev], status: 'info', waivable: false,
          detail: 'Die Suche der bisherigen Website entfällt; die neue Site ist kurz genug, um über die Navigation erreichbar zu sein.',
        });
        continue;
      }

      let preserved: string | null = null;
      if (form.purpose === 'contact') {
        const match = configured.find((f) => f.kind === 'contact-form' && f.content.variant !== 'newsletter') ?? configured.find((f) => f.kind === 'booking');
        if (match) preserved = `Formular „${String(match.content.heading ?? 'Anfrage')}" sendet an ${targetLabel(match.content.target)}.`;
      } else if (form.purpose === 'newsletter') {
        const match = configured.find((f) => f.kind === 'contact-form' && f.content.variant === 'newsletter');
        if (match) preserved = `Newsletter-Formular sendet an ${targetLabel(match.content.target)}.`;
      } else if (form.purpose === 'booking') {
        const match = configured.find((f) => f.kind === 'booking')
          ?? configured.find((f) => f.kind === 'contact-form' && Array.isArray(f.content.fields) && f.content.fields.includes('slot'));
        // Ein Link auf die alte Seite selbst erhält nichts: Nach dem Umzug
        // gibt es sie nicht mehr (wie bei Login und Strecken unten).
        const link = links.find((l) => sameTarget(l, target) && !isSameSitePath(l, host));
        if (match) preserved = `Terminwunsch über „${String(match.content.heading ?? 'Formular')}" an ${targetLabel(match.content.target)}.`;
        else if (link) preserved = `Verlinkt: ${link}.`;
      } else {
        // Login, Bestellung, sonstige: erhalten, wenn der Neubau auf die
        // Strecke verweist (eigene Adresse, die weiter besteht).
        const link = links.find((l) => sameTarget(l, target) || sameTarget(l, page.url));
        if (link && !isSameSitePath(link, host)) preserved = `Verlinkt: ${link}.`;
      }

      items.push({
        key, kind, label, source: target, evidence: [form.ev], waivable: true,
        status: preserved ? 'preserved' : 'lost',
        detail: preserved ?? lostFormDetail(form, target, host),
      });
    }
  }

  // ── Buchungs-, Zahlungs- und Shop-Strecken (Links) ──────────────────
  const seenLinks = new Set<string>();
  for (const page of snapshot.pages) {
    for (const link of page.backendLinks) {
      const key = `${link.kind}:${normalizeTarget(link.href)}`;
      if (seenLinks.has(key)) continue;
      seenLinks.add(key);
      const kind: BackendItemKind = link.kind === 'booking' ? 'booking' : 'payment';
      const label = link.kind === 'booking' ? 'Buchungsstrecke' : link.kind === 'shop' ? 'Shop' : 'Zahlungsweg';
      const own = isOnSourceSite(link.href, host);
      const match = links.find((l) => sameTarget(l, link.href));
      const preserved = match && !(own && isSameSitePath(match, host)) ? `Verlinkt: ${match}.` : null;
      items.push({
        key, kind, label: `${label}${link.label ? ` („${link.label}")` : ''}`, source: link.href, evidence: [link.ev], waivable: true,
        status: preserved ? 'preserved' : 'lost',
        detail: preserved ?? (own
          ? `Liegt auf der bisherigen Website (${pathOf(link.href)}). Ersetzt der Neubau sie unter derselben Domain, ist die Strecke danach nicht mehr erreichbar — eine eigenständige Adresse verlinken (z. B. im Hero oder in der Navigation) oder bewusst verzichten. Bleibt die bisherige Adresse bestehen, genau das als Begründung festhalten.`
          : `Der Neubau verlinkt ${hostOf(link.href)} nicht. Link in Hero, Navigation oder Aufforderungsband eintragen — oder bewusst verzichten.`),
      });
    }
  }

  // ── Eingebettete Dienste ────────────────────────────────────────────
  const seenHosts = new Set<string>();
  for (const page of snapshot.pages) {
    for (const resource of page.thirdParty) {
      const entry = embeddedService(resource);
      if (!entry) continue;
      const key = `embed:${resource.category}:${baseDomain(resource.host)}`;
      if (seenHosts.has(key)) continue;
      seenHosts.add(key);
      const linked = links.find((l) => hostOf(l) !== null && baseDomain(hostOf(l) as string) === baseDomain(resource.host));
      const targetForm = configured.find((f) => typeof f.content.target === 'string' && hostOf(f.content.target as string) !== null && baseDomain(hostOf(f.content.target as string) as string) === baseDomain(resource.host));
      if (entry.status === 'info') {
        items.push({ key, kind: entry.kind, label: entry.label, source: resource.host, evidence: [resource.ev], status: 'info', waivable: false, detail: entry.detail });
        continue;
      }
      const preserved = linked ? `Verlinkt: ${linked}.` : targetForm ? `Formular sendet an ${targetLabel(targetForm.content.target)}.` : null;
      items.push({
        key, kind: entry.kind, label: entry.label, source: resource.host, evidence: [resource.ev], waivable: true,
        status: preserved ? 'preserved' : 'lost',
        detail: preserved ?? entry.detail,
      });
    }
  }

  // ── Verzicht anwenden ───────────────────────────────────────────────
  const byKey = new Map(waivers.map((w) => [w.key, w]));
  for (const item of items) {
    const waiver = byKey.get(item.key);
    if (waiver && item.status === 'lost' && item.waivable) {
      item.status = 'waived';
      item.detail = `Bewusst entfallen: ${waiver.reason}`;
    }
  }

  // ── Umfang ──────────────────────────────────────────────────────────
  const coverage: string[] = [];
  const unverified: string[] = [];
  const fetched = snapshot.crawl.fetched.length;
  coverage.push(`Geprüft: Formulare, Links und Einbettungen auf ${fetched} gelesene${fetched === 1 ? 'r Seite' : 'n Seiten'}. Schnittstellen, die erst per Skript aufgerufen werden, sind so nicht sichtbar.`);
  const known = Math.max(snapshot.sitemap.urlCount, uniqueInternalPages(snapshot));
  if (known > fetched) {
    const text = `Die Ausgangsseite hat ${snapshot.sitemap.urlCount > 0 ? `laut Sitemap ${snapshot.sitemap.urlCount}` : `mindestens ${known} verlinkte`} Seiten, gelesen wurden ${fetched}. Formulare und Strecken auf den übrigen Seiten sind nicht geprüft.`;
    coverage.push(text);
    unverified.push(text);
  }
  const blocked = snapshot.crawl.skipped.filter((s) => /robots/i.test(s.reason)).length;
  if (blocked > 0) {
    const text = `${blocked} Seite${blocked === 1 ? '' : 'n'} per robots.txt vom Abruf ausgeschlossen und nicht geprüft.`;
    coverage.push(text);
    unverified.push(text);
  }
  // Nur teilweise gelesene Dokumente: Was hinter der Lesegrenze stand, ist
  // nicht gesehen — „nichts gefunden" hieße dort nicht „nichts vorhanden".
  const truncated = snapshot.pages.filter((p) => p.truncated === true).map((p) => pathOf(p.url));
  if (truncated.length > 0) {
    const text = `Nur teilweise gelesen (Größengrenze): ${listOf(truncated)}. Formulare und Strecken im Rest ${truncated.length === 1 ? 'des Dokuments' : 'dieser Dokumente'} sind nicht geprüft.`;
    coverage.push(text);
    unverified.push(text);
  }
  // Seiten, die ihren Inhalt erst per Skript erzeugen: so gut wie kein Text
  // im HTML (eine App-Hülle) und kein Formular — Formulare, die dort zur
  // Laufzeit entstehen, sieht ein Abruf ohne Skriptausführung nicht.
  const scripted = snapshot.pages.filter((p) => p.text.words < 20 && p.forms.length === 0 && p.statusCode < 400).map((p) => pathOf(p.url));
  if (scripted.length > 0) {
    const text = `Kaum Text im ausgelieferten HTML: ${listOf(scripted)}. Inhalte und Formulare entstehen dort vermutlich per Skript und sind so nicht geprüft.`;
    coverage.push(text);
    unverified.push(text);
  }
  // Skripte und Rahmen unbekannter Anbieter: Ob sie ein Formular, eine
  // Buchung oder eine Zahlung bereitstellen, ist ohne Ausführung nicht
  // feststellbar. Bekannte Anbieter stehen oben als eigene Punkte.
  const unknownHosts = [...new Set(snapshot.pages.flatMap((p) => p.thirdParty)
    .filter((t) => t.category === 'other' && (t.via === 'script' || t.via === 'iframe' || t.via === 'embed'))
    .map((t) => t.host))];
  if (unknownHosts.length > 0) {
    const text = `Eingebunden von unbekannten Anbietern: ${listOf(unknownHosts)}. Ob darüber Formulare, Buchungen oder Zahlungen laufen, ist ohne Ausführung nicht prüfbar.`;
    coverage.push(text);
    unverified.push(text);
  }

  const lost = (kind: BackendItemKind) => items.filter((i) => i.kind === kind && i.status === 'lost').map((i) => `${i.label} (${i.source})`);
  const comparison: BackendComparison = {
    lostFormTargets: lost('form-target'),
    lostPaymentPaths: lost('payment'),
    lostBookingPaths: lost('booking'),
    lostApiEndpoints: [...lost('api'), ...lost('embed')],
    // Einwilligungskategorien gehen nicht verloren, weil der Neubau die
    // zugehörigen Dienste nicht lädt: keine Messung, keine Werbe-Pixel —
    // also auch keine Kategorie, die noch abgefragt werden müsste. Was
    // entfällt, steht als `tracking` im Bericht.
    lostConsentCategories: [],
    waived: items.filter((i) => i.status === 'waived').map((i) => {
      const waiver = byKey.get(i.key) as BackendWaiver;
      return `${i.label} (${i.source}) — bewusst entfallen am ${waiver.at.slice(0, 10)}: ${waiver.reason}`;
    }),
    unverified,
  };

  return { items, comparison, coverage };
}

/**
 * Hash des Vergleichs, an den eine Freigabe gebunden wird: Lauf, Verluste,
 * bewusste Verzichte und Ungeprüftes. Ändert sich einer davon (ein Verzicht
 * wird zurückgenommen, eine neue Prüfgrenze kommt hinzu), gilt eine zuvor
 * erteilte Freigabe nicht mehr — auch wenn das Bündel bytegleich ist.
 */
export function backendDigest(runId: string, comparison: BackendComparison): Promise<string> {
  return canonicalHash({ runId, comparison });
}

// ─────────────────────────────────────────────────────────────────────
// Neubau: was tatsächlich verlinkt und angebunden ist
// ─────────────────────────────────────────────────────────────────────

function visible(block: SiteBlock): boolean {
  return block.content.hidden !== true;
}

function visibleForms(bp: SiteBlueprint): SiteBlock[] {
  return bp.pages.flatMap((p) => p.blocks).filter((b) => (b.kind === 'contact-form' || b.kind === 'booking') && visible(b));
}

/** Alle Link-Ziele sichtbarer Blöcke (`href`, `…Href`), in Rohform. */
function collectLinks(bp: SiteBlueprint): string[] {
  const out = new Set<string>();
  const walk = (value: unknown, key: string, depth: number): void => {
    if (depth > 6) return;
    if (typeof value === 'string') {
      if (key === 'href' || key.endsWith('Href')) out.add(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry, key, depth + 1);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value)) walk(v, k, depth + 1);
    }
  };
  for (const page of bp.pages) for (const block of page.blocks) if (visible(block)) walk(block.content, '', 0);
  return [...out].filter((l) => l !== '');
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

function embeddedService(resource: ThirdPartyResource): { kind: BackendItemKind; label: string; status: 'lost' | 'info'; detail: string } | null {
  switch (resource.category) {
    case 'booking':
      return { kind: 'booking', label: `Buchungs-Widget (${resource.host})`, status: 'lost', detail: `Das eingebettete Buchungssystem von ${resource.host} wird im Neubau nicht geladen. Auf die Buchungsseite des Anbieters verlinken — oder bewusst verzichten.` };
    case 'payment':
      return { kind: 'payment', label: `Zahlungsdienst (${resource.host})`, status: 'lost', detail: `Die Zahlungsanbindung über ${resource.host} läuft im Neubau nicht mit. Auf eine Bezahlseite des Anbieters verlinken — oder bewusst verzichten.` };
    case 'form':
      return { kind: 'form-target', label: `Formulardienst (${resource.host})`, status: 'lost', detail: `Das eingebettete Formular von ${resource.host} wird nicht geladen. Das Formular im Neubau auf den Dienst oder ein anderes Ziel richten — oder bewusst verzichten.` };
    case 'chat':
      return { kind: 'embed', label: `Chat (${resource.host})`, status: 'lost', detail: `Das Chat-Widget von ${resource.host} wird nicht geladen — Besucher erreichen Sie darüber nach dem Umzug nicht mehr. Kontaktweg im Neubau prüfen und bewusst verzichten oder einen Chat mit Freigabe neu einrichten.` };
    case 'analytics':
    case 'ads':
      return { kind: 'tracking', label: `${resource.category === 'ads' ? 'Werbe-Tracking' : 'Reichweitenmessung'} (${resource.host})`, status: 'info', detail: 'Wird im Neubau nicht geladen; die Einwilligungsabfrage dafür entfällt mit. Messung bei Bedarf neu und mit Einwilligung einrichten.' };
    case 'reviews':
      return { kind: 'embed', label: `Bewertungs-Widget (${resource.host})`, status: 'info', detail: 'Das Widget entfällt; belegte Bewertungen stehen als Text in der Vertrauensleiste.' };
    case 'video':
      return { kind: 'embed', label: `Video (${resource.host})`, status: 'info', detail: 'Eingebettete Videos werden nicht übernommen (Drittanbieter-Abruf ohne Einwilligung).' };
    default:
      return null;
  }
}

function lostFormDetail(form: SourceForm, target: string, host: string): string {
  switch (form.purpose) {
    case 'contact':
      return form.targetKind === 'mailto'
        ? `Die Ausgangsseite sendet Anfragen per E-Mail (${target.replace(/^mailto:/, '')}). Im Anfrageformular des Neubaus ein Ziel eintragen — https-Endpunkt oder mailto.`
        : `Die Ausgangsseite sendet Anfragen an ${hostOf(target) === host || isOnSourceSite(target, host) ? `die bisherige Website (${pathOf(target)})` : hostOf(target) ?? target}. Im Anfrageformular des Neubaus ein Ziel eintragen — https-Endpunkt oder mailto.`;
    case 'newsletter':
      return 'Die Newsletter-Anmeldung hat im Neubau kein Formular mit Ziel. Ein Formular (Variante „Newsletter") mit Ziel anlegen — oder bewusst verzichten.';
    case 'booking':
      return 'Terminanfragen hatten ein eigenes Formular. Im Neubau ein Formular mit Terminfeld und Ziel einrichten oder auf die Buchungsseite verlinken — oder bewusst verzichten.';
    case 'order':
      return 'Bestellungen liefen über ein Formular der bisherigen Website. Auf eine eigenständige Bestellstrecke verlinken — oder bewusst verzichten.';
    case 'login':
      return 'Der Kundenzugang lag auf der bisherigen Website. Auf seine weiterhin bestehende Adresse verlinken — oder bewusst verzichten.';
    default:
      return 'Dieses Formular hat im Neubau keine Entsprechung. Auf die weiterhin bestehende Strecke verlinken — oder bewusst verzichten.';
  }
}

function normalizeTarget(value: string): string {
  if (value.startsWith('mailto:')) return value.toLowerCase();
  try {
    const url = new URL(value);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${path.toLowerCase()}`;
  } catch {
    return value.toLowerCase();
  }
}

function sameTarget(href: string, target: string): boolean {
  if (!/^https?:/i.test(href)) return false;
  return normalizeTarget(href) === normalizeTarget(target);
}

function hostOf(value: string): string | null {
  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function pathOf(value: string): string {
  try {
    return new URL(value).pathname || '/';
  } catch {
    return value;
  }
}

function isOnSourceSite(value: string, host: string): boolean {
  const h = hostOf(value);
  return h !== null && sameSite(h, host);
}

/** Absoluter Link auf die bisherige Website selbst (der nach dem Umzug ins Leere führt). */
function isSameSitePath(href: string, host: string): boolean {
  const h = hostOf(href);
  return h !== null && h.replace(/^www\./, '') === host.replace(/^www\./, '');
}

function listOf(values: string[]): string {
  return values.length > 5 ? `${values.slice(0, 5).join(', ')} und ${values.length - 5} weitere` : values.join(', ');
}

function targetLabel(target: unknown): string {
  const value = String(target ?? '');
  return value.startsWith('mailto:') ? value.slice(7) : hostOf(value) ?? value;
}

function uniqueInternalPages(snapshot: SourceSnapshot): number {
  const paths = new Set<string>();
  for (const page of snapshot.pages) {
    for (const link of page.internalLinks) {
      try {
        const url = new URL(link);
        if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?)$/i.test(url.pathname)) continue;
        paths.add(url.pathname.replace(/\/+$/, '') || '/');
      } catch {
        // Ungültige Adressen zählen nicht.
      }
    }
    try {
      paths.add(new URL(page.url).pathname.replace(/\/+$/, '') || '/');
    } catch {
      // ebenso
    }
  }
  return paths.size;
}
