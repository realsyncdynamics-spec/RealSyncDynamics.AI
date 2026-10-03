// PUBLISH — Checkliste vor dem GO.
//
// Der Publish Gate entscheidet, ob veröffentlicht werden **darf** (Recht,
// Nachweis, Backend, Freigaben). Diese Liste zeigt, ob die Site **fertig**
// ist: Titel und Beschreibungen, genau eine H1, Gewicht und externe
// Abrufe, Formularziel, Rechtstexte, Weiterleitungen, Bildrechte.
//
// Sie arbeitet auf dem gerenderten Bündel — also auf dem, was ausgeliefert
// würde, nicht auf einer Annahme darüber. Sperrende Punkte (`blocker`) sind
// immer auch Befunde der Analyse und sperren dort; die Liste erklärt sie nur
// in der Sprache des Umzugs. Sie ist kein zweiter Entscheidungsweg (G2).

import { isDeliverableFormTarget } from '../analysis/blueprint.ts';
import type { SiteBlueprint } from '../types.ts';

export type ChecklistStatus = 'ok' | 'todo' | 'blocker' | 'info';

export interface ChecklistItem {
  key: string;
  group: 'seo' | 'leistung' | 'formular' | 'recht' | 'umzug';
  title: string;
  status: ChecklistStatus;
  detail: string;
}

export interface PublishChecklist {
  items: ChecklistItem[];
  blockers: number;
  todos: number;
}

export interface ChecklistInput {
  blueprint: SiteBlueprint;
  /** Dateien des Bündels (`buildDeploymentArtifact`). */
  files: { path: string; content: string; bytes: number }[];
  baseUrl: string | null;
  /** Host der Ausgangsseite — Bilder von dort gelten als „noch nicht umgezogen". */
  sourceHost: string | null;
  redirects: { from: string; to: string }[];
}

const LEGAL_PATHS = new Set(['/impressum', '/datenschutz', '/barrierefreiheit']);
const PAGE_BUDGET_BYTES = 120_000;

export function buildPublishChecklist(input: ChecklistInput): PublishChecklist {
  const { blueprint, files } = input;
  const items: ChecklistItem[] = [];
  const pages = files.filter((f) => f.path.endsWith('.html'));
  const visible = blueprint.pages.flatMap((p) => p.blocks.map((b) => ({ page: p, block: b }))).filter((e) => e.block.content.hidden !== true);

  // ── SEO ─────────────────────────────────────────────────────────────
  const title = blueprint.seo.defaultTitle;
  items.push({
    key: 'seo.title', group: 'seo', title: 'Seitentitel',
    status: title.length > 60 ? 'todo' : title.length < 15 ? 'info' : 'ok',
    detail: title.length > 60 ? `„${title}" hat ${title.length} Zeichen — Suchmaschinen kürzen ab etwa 60.` : `„${title}" (${title.length} Zeichen).`,
  });

  const badDescriptions = blueprint.pages.filter((p) => !LEGAL_PATHS.has(p.path) && (p.description.length < 50 || p.description.length > 160));
  items.push({
    key: 'seo.descriptions', group: 'seo', title: 'Meta-Beschreibungen',
    status: badDescriptions.length === 0 ? 'ok' : 'todo',
    detail: badDescriptions.length === 0
      ? 'Alle Inhaltsseiten haben eine Beschreibung mit 50–160 Zeichen.'
      : `Außerhalb von 50–160 Zeichen: ${badDescriptions.map((p) => `${p.path} (${p.description.length})`).join(', ')}.`,
  });

  const h1Issues = pages
    .map((f) => ({ path: f.path, count: (f.content.match(/<h1[\s>]/g) ?? []).length }))
    .filter((p) => p.count !== 1);
  items.push({
    key: 'seo.h1', group: 'seo', title: 'Genau eine Hauptüberschrift je Seite',
    status: h1Issues.length === 0 ? 'ok' : 'todo',
    detail: h1Issues.length === 0 ? `Geprüft auf ${pages.length} Seiten.` : `Abweichend: ${h1Issues.map((p) => `${p.path} (${p.count})`).join(', ')}.`,
  });

  // Eine andere Zieldomain als die der Ausgangsseite ist erlaubt (Umzug),
  // aber eine Entscheidung: Die Weiterleitungen alter Adressen greifen nur
  // auf der alten Domain — und wer GO gibt, soll sehen, wohin es geht.
  const targetHost = input.baseUrl ? hostOf(input.baseUrl) : null;
  const otherDomain = Boolean(targetHost && input.sourceHost && !sameBase(targetHost, input.sourceHost) && !sameBase(input.sourceHost, targetHost));
  items.push({
    key: 'seo.domain', group: 'seo', title: 'Zieldomain, Canonical und Sitemap',
    status: !input.baseUrl ? 'todo' : otherDomain ? 'todo' : 'ok',
    detail: !input.baseUrl
      ? 'Zieldomain eintragen — ohne sie gibt es nur relative Canonicals und keine Sitemap.'
      : otherDomain
        ? `Canonical-Links und sitemap.xml auf ${targetHost} — die Ausgangsseite liegt auf ${input.sourceHost}. Weiterleitungen alter Adressen wirken nur, wenn die neue Site dort ausgeliefert wird; sonst auf der alten Domain einrichten.`
        : `Canonical-Links und sitemap.xml auf ${targetHost}.`,
  });

  // ── Leistung ────────────────────────────────────────────────────────
  const heaviest = [...pages].sort((a, b) => b.bytes - a.bytes)[0];
  const total = files.reduce((n, f) => n + f.bytes, 0);
  items.push({
    key: 'perf.weight', group: 'leistung', title: 'Seitengewicht',
    status: heaviest && heaviest.bytes > PAGE_BUDGET_BYTES ? 'todo' : 'ok',
    detail: heaviest
      ? `Größte Seite ${kb(heaviest.bytes)} (${heaviest.path}), Bündel gesamt ${kb(total)} — HTML und Stile in einer Datei, kein Skript.`
      : 'Keine Seiten im Bündel.',
  });

  const external = new Map<string, number>();
  for (const page of pages) {
    for (const match of page.content.matchAll(/<(?:img|script|link|iframe|video|audio|source)\b[^>]*?\s(?:src|href)="(https?:\/\/[^"]+)"/g)) {
      const tag = match[0];
      if (/^<link\b/.test(tag) && /rel="canonical"/.test(tag)) continue;
      const host = hostOf(match[1]);
      if (host) external.set(host, (external.get(host) ?? 0) + 1);
    }
  }
  const fromSource = input.sourceHost ? [...external.keys()].filter((h) => sameBase(h, input.sourceHost as string)) : [];
  items.push({
    key: 'perf.external', group: 'leistung', title: 'Externe Abrufe beim Laden',
    status: external.size === 0 ? 'ok' : 'todo',
    detail: external.size === 0
      ? 'Keine — Schriften, Stile und Karten werden nicht von Dritten geladen.'
      : `${[...external.entries()].map(([h, n]) => `${h} (${n}×)`).join(', ')}.${fromSource.length > 0 ? ' Bilder liegen noch auf der bisherigen Website — vor dem Umzug selbst hosten, sonst verschwinden sie mit ihr.' : ''}`,
  });

  const design = blueprint.design;
  const brandFonts = design ? [design.typography.display, design.typography.body].map(quotedFamily).filter((f): f is string => f !== null) : [];
  if (brandFonts.length > 0) {
    items.push({
      key: 'perf.fonts', group: 'leistung', title: 'Markenschrift',
      status: 'info',
      detail: `${[...new Set(brandFonts)].join(', ')} steht an erster Stelle, wird aber nicht geladen (kein Abruf bei Google Fonts). Ohne lokale Installation zeigt die Seite eine gleichartige Systemschrift; für exakte Darstellung die Schriftdateien selbst hosten.`,
    });
  }

  // ── Formular ────────────────────────────────────────────────────────
  const forms = visible.filter((e) => e.block.kind === 'contact-form' || e.block.kind === 'booking');
  const unconfigured = forms.filter((e) => !isDeliverableFormTarget(e.block.content.target));
  items.push({
    key: 'form.target', group: 'formular', title: 'Formularziel',
    status: forms.length === 0 ? 'info' : unconfigured.length === 0 ? 'ok' : 'blocker',
    detail: forms.length === 0
      ? 'Die Site hat kein Formular.'
      : unconfigured.length === 0
        ? `Anfragen gehen an ${[...new Set(forms.map((e) => targetLabel(e.block.content.target)))].join(', ')}.`
        : `Ohne Ziel: ${unconfigured.map((e) => `${e.page.path} („${String(e.block.content.heading ?? 'Formular')}")`).join(', ')} — Anfragen kämen nicht an. Ziel eintragen: https-Endpunkt oder mailto.`,
  });
  const hints = forms.map((e) => e.block.content.targetHint as { url?: unknown; backend?: unknown } | undefined).filter((h) => h && typeof h.url === 'string');
  if (unconfigured.length > 0 && hints.length > 0) {
    const hint = hints[0] as { url: string; backend?: unknown };
    items.push({
      key: 'form.hint', group: 'formular', title: 'Bisheriges Formularziel',
      status: 'info',
      detail: hint.backend === 'cms-plugin'
        ? `Die bisherige Seite sendete an ${hint.url} — ein CMS-Formular-Plugin, das aus einer statischen Seite nicht angesprochen werden kann. Neues Ziel wählen.`
        : `Die bisherige Seite sendete an ${hint.url}. Nur übernehmen, wenn dieser Empfänger ohne die alte Website weiter arbeitet.`,
    });
  }

  // ── Recht ───────────────────────────────────────────────────────────
  const legal = visible.filter((e) => e.block.kind === 'legal-text');
  const empty = legal.filter((e) => typeof e.block.content.body !== 'string' || e.block.content.body.trim().length < 40);
  items.push({
    key: 'legal.texts', group: 'recht', title: 'Impressum, Datenschutz, Barrierefreiheit',
    status: empty.length === 0 && legal.length > 0 ? 'ok' : 'blocker',
    detail: legal.length === 0
      ? 'Keine Rechtsseiten angelegt.'
      : empty.length === 0
        ? 'Wortlaut auf allen Rechtsseiten eingesetzt.'
        : `Wortlaut fehlt: ${empty.map((e) => e.page.path).join(', ')}. RealSync erzeugt keine Rechtstexte — die Datenschutzerklärung muss zur neuen Site passen (keine Tracker, Formular, gegebenenfalls Karte).`,
  });

  // Kundenbewertungen und -stimmen: Wer sie zeigt, muss angeben, ob und wie
  // er sicherstellt, dass sie von Kunden stammen (§ 5b Abs. 3 UWG). Das ist
  // ein Satz im Rechtstext, den RealSync nicht schreibt — aber benennt.
  const reviews = visible.filter((e) => e.block.kind === 'testimonials'
    || (e.block.kind === 'trust-bar' && JSON.stringify(e.block.content.items ?? []).match(/von 5|bewertung/i) !== null));
  if (reviews.length > 0) {
    items.push({
      key: 'legal.reviews', group: 'recht', title: 'Hinweis zu Kundenbewertungen',
      status: 'todo',
      detail: `Die Site zeigt Kundenstimmen oder Bewertungen (${[...new Set(reviews.map((e) => e.page.path))].join(', ')}). Angeben, ob und wie sichergestellt ist, dass sie von Kunden stammen (§ 5b Abs. 3 UWG) — z. B. in der Datenschutzerklärung oder direkt bei den Bewertungen.`,
    });
  }

  // ── Umzug ───────────────────────────────────────────────────────────
  items.push({
    key: 'move.redirects', group: 'umzug', title: 'Weiterleitungen alter Adressen',
    status: input.redirects.length > 0 ? 'ok' : 'info',
    detail: input.redirects.length > 0
      ? `${input.redirects.length} alte Pfade leiten dauerhaft (301) auf die neuen Seiten weiter (_redirects im Export), z. B. ${input.redirects.slice(0, 3).map((r) => `${r.from} → ${r.to}`).join(', ')}.`
      : 'Keine alten Pfade erkannt, die umgeleitet werden müssten.',
  });

  const unconfirmed = visible.filter((e) => {
    const media = e.block.content.media as { kind?: unknown; src?: unknown; rightsConfirmed?: unknown } | undefined;
    return e.block.kind === 'hero' && media?.kind === 'image' && typeof media.src === 'string' && media.rightsConfirmed !== true;
  });
  if (unconfirmed.length > 0) {
    items.push({
      key: 'move.image-rights', group: 'umzug', title: 'Bildrechte',
      status: 'todo',
      detail: `${unconfirmed.length === 1 ? 'Ein Bild' : `${unconfirmed.length} Bilder`} der bisherigen Website ist vorgemerkt, aber ohne bestätigte Rechte — bis zur Bestätigung im Editor wird es nicht angezeigt.`,
    });
  }

  return {
    items,
    blockers: items.filter((i) => i.status === 'blocker').length,
    todos: items.filter((i) => i.status === 'todo').length,
  };
}

function hostOf(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function sameBase(a: string, b: string): boolean {
  const strip = (h: string) => h.replace(/^www\./, '').toLowerCase();
  return strip(a) === strip(b) || strip(a).endsWith(`.${strip(b)}`);
}

function kb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
}

function quotedFamily(stack: string): string | null {
  if (!stack.startsWith('"')) return null;
  const end = stack.indexOf('"', 1);
  return end > 1 ? stack.slice(1, end) : null;
}

function targetLabel(target: unknown): string {
  const value = String(target ?? '');
  if (value.startsWith('mailto:')) return value.slice(7);
  return hostOf(value) ?? value;
}
