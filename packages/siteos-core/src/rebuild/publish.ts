// PUBLISH — Veröffentlichungsreife prüfen, nie veröffentlichen.
//
// Diese Datei beantwortet „darf das raus?" mit einer Liste geprüfter
// Punkte — und sie beantwortet **nicht** „geht das raus?". Das GO ist
// eine menschliche Entscheidung, die der Handler serverseitig festhält,
// an den Artefakt-Hash gebunden (siehe `publish/gate.ts`, G6).
//
// Fail-closed wie beim Gate: Was nicht geprüft werden konnte, ist
// `unknown` und blockiert. Eine Vorschau mit Platzhaltern ist nicht
// veröffentlichbar — „Referenz ergänzen" auf einer Live-Seite wäre kein
// Schönheitsfehler, sondern die sichtbare Spur eines übergangenen Schritts.

import type { PublishGateEvaluation } from '../publish/gate.ts';
import { visibleComponents } from './components.ts';
import { wordCount } from './html.ts';
import type { DeployPath, PublishCheck, PublishReadiness, RebuildDirection } from './types.ts';

export interface ReadinessInput {
  direction: RebuildDirection;
  /** Gerendertes Vorschau-Dokument. */
  previewHtml: string;
  /** Hash des Artefakts (Bundle oder Blueprint), auf das sich die Prüfung bezieht. */
  artifactSha256: string;
  evaluatedAt: string;
  /** Ergebnis des Publish Gate über den Blueprint, falls schon bewertet. */
  gate?: PublishGateEvaluation | null;
}

export function assessPublishReadiness(input: ReadinessInput): PublishReadiness {
  const { direction, previewHtml: html } = input;
  const checks: PublishCheck[] = [];
  const visible = visibleComponents(direction);
  const hero = visible.find((c) => c.kind === 'hero');
  const lead = visible.find((c) => c.kind === 'lead-form');

  // Vorschau
  checks.push(html.length > 0 && /<html\b/i.test(html)
    ? { code: 'preview.rendered', label: 'Vorschau erzeugt', status: 'pass', detail: `${Math.round(html.length / 1024)} kB Dokument.` }
    : { code: 'preview.rendered', label: 'Vorschau erzeugt', status: 'fail', detail: 'Kein Vorschau-Dokument.' });

  // Mobile / Desktop
  checks.push(/<meta\s+name=["']viewport["']/i.test(html)
    ? { code: 'responsive.viewport', label: 'Viewport gesetzt', status: 'pass', detail: 'width=device-width, initial-scale=1.' }
    : { code: 'responsive.viewport', label: 'Viewport gesetzt', status: 'fail', detail: 'Kein Viewport-Meta.' });
  const bp = direction.designSystem.breakpoints;
  checks.push({ code: 'responsive.breakpoints', label: 'Breakpoints', status: 'pass', detail: `${bp.sm} / ${bp.md} / ${bp.lg} px — Layout in drei Stufen.` });
  const headlineWords = hero?.text.headline ? wordCount(hero.text.headline) : 0;
  checks.push(headlineWords > 0 && headlineWords <= 14
    ? { code: 'responsive.hero-length', label: 'Hero-Überschrift mobil lesbar', status: 'pass', detail: `${headlineWords} Wörter.` }
    : headlineWords === 0
      ? { code: 'responsive.hero-length', label: 'Hero-Überschrift mobil lesbar', status: 'fail', detail: 'Keine Hero-Überschrift.' }
      : { code: 'responsive.hero-length', label: 'Hero-Überschrift mobil lesbar', status: 'warn', detail: `${headlineWords} Wörter — auf 390 px werden das vier bis fünf Zeilen.` });
  checks.push(direction.designSystem.buttons.height >= 44
    ? { code: 'responsive.tap-targets', label: 'Tap-Ziele ≥ 44 px', status: 'pass', detail: `Buttons ${direction.designSystem.buttons.height} px hoch.` }
    : { code: 'responsive.tap-targets', label: 'Tap-Ziele ≥ 44 px', status: 'warn', detail: `Buttons ${direction.designSystem.buttons.height} px — unter 44 px.` });

  // SEO
  const titleLen = direction.seo.title.length;
  checks.push(titleLen >= 20 && titleLen <= 60
    ? { code: 'seo.title', label: 'SEO-Titel', status: 'pass', detail: `${titleLen} Zeichen.` }
    : { code: 'seo.title', label: 'SEO-Titel', status: titleLen === 0 ? 'fail' : 'warn', detail: titleLen === 0 ? 'Kein Titel.' : `${titleLen} Zeichen — Ziel 20–60.` });
  const descLen = direction.seo.description.length;
  checks.push(descLen >= 50 && descLen <= 155
    ? { code: 'seo.description', label: 'Meta-Description', status: 'pass', detail: `${descLen} Zeichen.` }
    : { code: 'seo.description', label: 'Meta-Description', status: descLen === 0 ? 'fail' : 'warn', detail: descLen === 0 ? 'Keine Description.' : `${descLen} Zeichen — Ziel 50–155.` });
  checks.push(/<script\s+type=["']application\/ld\+json["']/i.test(html)
    ? { code: 'seo.structured-data', label: 'Strukturierte Daten', status: 'pass', detail: 'JSON-LD vorhanden.' }
    : { code: 'seo.structured-data', label: 'Strukturierte Daten', status: 'warn', detail: 'Kein JSON-LD.' });
  checks.push(/<html\b[^>]*\blang=/i.test(html)
    ? { code: 'seo.lang', label: 'Sprache deklariert', status: 'pass', detail: 'lang gesetzt.' }
    : { code: 'seo.lang', label: 'Sprache deklariert', status: 'fail', detail: 'Kein lang-Attribut.' });

  // Performance-Basics
  // Nur geladene Ressourcen zählen: Skripte, Frames, Stylesheets, Preloads.
  // `rel="canonical"` ist ein Verweis, keine Anfrage.
  const externalRefs = [
    ...[...html.matchAll(/<(?:script|iframe)\b[^>]*\ssrc=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => /\brel=["'][^"']*\b(?:stylesheet|preload|modulepreload|preconnect|dns-prefetch|icon)\b/i.test(tag))
      .map((tag) => /\bhref=["'](https?:\/\/[^"']+)["']/i.exec(tag)?.[1] ?? '')
      .filter((href) => href !== ''),
  ];
  checks.push(externalRefs.length === 0
    ? { code: 'perf.third-party', label: 'Keine Drittanbieter vor Einwilligung', status: 'pass', detail: 'Keine externen Skripte, Styles oder Frames.' }
    : { code: 'perf.third-party', label: 'Keine Drittanbieter vor Einwilligung', status: 'fail', detail: `${externalRefs.length} externe Ressourcen: ${externalRefs.slice(0, 3).join(', ')}.` });
  const images = [...html.matchAll(/<img\b[^>]*src=["'](https?:\/\/[^"']+)["']/gi)].length;
  checks.push(images <= 12
    ? { code: 'perf.images', label: 'Bildanzahl', status: 'pass', detail: `${images} externe Bilder.` }
    : { code: 'perf.images', label: 'Bildanzahl', status: 'warn', detail: `${images} Bilder — Ladezeit prüfen.` });
  checks.push({ code: 'perf.fonts', label: 'Schriften', status: 'pass', detail: 'System-Stacks, kein externes Font-Laden. Markenschrift wird nur mit Self-Hosting sichtbar.' });
  checks.push(html.length <= 250_000
    ? { code: 'perf.document-size', label: 'Dokumentgröße', status: 'pass', detail: `${Math.round(html.length / 1024)} kB.` }
    : { code: 'perf.document-size', label: 'Dokumentgröße', status: 'warn', detail: `${Math.round(html.length / 1024)} kB — über 250 kB.` });

  // Formularziel
  if (lead) {
    checks.push(direction.leadFlow.formTarget
      ? { code: 'form.target', label: 'Formularziel konfiguriert', status: 'pass', detail: direction.leadFlow.formTarget }
      : { code: 'form.target', label: 'Formularziel konfiguriert', status: 'fail', detail: 'Kein Ziel — Anfragen würden ins Leere gehen.' });
  } else {
    checks.push({ code: 'form.target', label: 'Formularziel konfiguriert', status: 'warn', detail: 'Kein Formular sichtbar — Conversion-Pfad läuft über Telefon/E-Mail?' });
  }

  // Inhalt
  const placeholders = visible.filter((c) => c.placeholder);
  checks.push(placeholders.length === 0
    ? { code: 'content.placeholders', label: 'Keine Platzhalter', status: 'pass', detail: 'Alle sichtbaren Komponenten tragen echte Inhalte.' }
    : { code: 'content.placeholders', label: 'Keine Platzhalter', status: 'fail', detail: `${placeholders.length} sichtbare Platzhalter: ${placeholders.map((c) => c.kind).join(', ')}. Inhalte ergänzen oder Komponenten ausblenden.` });

  // Pflichtseiten
  checks.push(/href=["']\/impressum["']/i.test(html) && /href=["']\/datenschutz["']/i.test(html)
    ? { code: 'legal.links', label: 'Impressum und Datenschutz verlinkt', status: 'pass', detail: 'Footer-Links vorhanden.' }
    : { code: 'legal.links', label: 'Impressum und Datenschutz verlinkt', status: 'fail', detail: 'Pflichtlinks fehlen.' });

  // Governance-Gate
  if (input.gate === undefined || input.gate === null) {
    checks.push({ code: 'governance.gate', label: 'Publish Gate', status: 'unknown', detail: 'Noch nicht bewertet — wird serverseitig über den Blueprint ausgewertet.' });
  } else if (input.gate.publishable) {
    checks.push({ code: 'governance.gate', label: 'Publish Gate', status: 'pass', detail: `Bewertung ${input.gate.evaluation_id}: veröffentlichbar.` });
  } else if (input.gate.status === 'blocked') {
    checks.push({ code: 'governance.gate', label: 'Publish Gate', status: 'fail', detail: input.gate.blockers.join(' · ') || 'Gate blockiert.' });
  } else {
    // `pending`: nichts blockiert, aber das Gate verlangt eine menschliche
    // Freigabe — genau die ist das GO. Kein Blocker, ein Hinweis.
    checks.push({ code: 'governance.gate', label: 'Publish Gate', status: 'warn', detail: `Freigabe durch Owner/Admin/DPO erforderlich${input.gate.warnings.length ? `: ${input.gate.warnings.join(' · ')}` : '.'}` });
  }

  const blockers = checks.filter((c) => c.status === 'fail' || c.status === 'unknown').map((c) => `${c.label}: ${c.detail}`);
  const warnings = checks.filter((c) => c.status === 'warn').map((c) => `${c.label}: ${c.detail}`);

  return {
    checks,
    ready: blockers.length === 0,
    blockers,
    warnings,
    deployPaths: [...DEPLOY_PATHS],
    approvalRequired: true,
    artifactSha256: input.artifactSha256,
    evaluatedAt: input.evaluatedAt,
  };
}

/**
 * Deploy-Pfade, ehrlich beschriftet. Was es nicht gibt, heißt nicht „bald",
 * sondern `coming-soon` mit Begründung — wie im Studio.
 */
export const DEPLOY_PATHS: readonly DeployPath[] = Object.freeze([
  { key: 'export-html', label: 'Export (HTML-Bundle)', status: 'available', detail: 'Statisches Bundle mit Hash — zum Hosting Ihrer Wahl.' },
  { key: 'cloudflare-pages', label: 'Cloudflare Pages', status: 'requires-setup', detail: 'Preview-Deploy über den SiteOS-Worker; Produktions-Deploy braucht ein verbundenes Projekt.' },
  { key: 'custom-domain', label: 'Eigene Domain', status: 'coming-soon', detail: 'Domain-Anbindung bleibt Preview, bis der Cutover-Workflow freigegeben ist.' },
]);
