// Kontrollierte Komponenten — Katalog, Varianten, Editor-Operationen.
//
// Zwölf feste Bausteine statt freier Generierung. Jeder hat einen kleinen
// Satz benannter Stilvarianten; was nicht im Katalog steht, gibt es nicht.
// Das ist die Bedingung dafür, dass ein Rebuild wie ein gestaltetes Ganzes
// wirkt und nicht wie eine Sammlung zufälliger Blöcke.
//
// Die Operationen hier sind die einzige Art, eine Komponente aus dem
// Editor zu ändern. Sie prüfen jede Eingabe gegen den Katalog und lehnen
// ab, statt still zu korrigieren — eine abgelehnte Variante ist ein
// sichtbarer Befund, eine still ersetzte ein verstecktes Missverständnis.

import type { ComponentOperation, RebuildComponent, RebuildComponentKind, RebuildCta, RebuildDirection, RebuildMedia, RevisionChange } from './types.ts';

export interface ComponentSpec {
  kind: RebuildComponentKind;
  variants: readonly string[];
  /** Redaktionelle Felder in `text`. */
  textFields: readonly string[];
  /** Darf einen CTA tragen? */
  cta: boolean;
  /** Darf ein Bild tragen? */
  media: boolean;
  /** Trägt ein Formularziel? */
  formTarget: boolean;
  /** Höchstzahl Einträge in `items`. */
  maxItems: number;
}

export const COMPONENT_CATALOG: Readonly<Record<RebuildComponentKind, ComponentSpec>> = Object.freeze({
  hero: { kind: 'hero', variants: ['split', 'centered', 'statement'], textFields: ['eyebrow', 'headline', 'subline'], cta: true, media: true, formTarget: false, maxItems: 0 },
  'trust-bar': { kind: 'trust-bar', variants: ['facts', 'quiet', 'logos'], textFields: ['heading'], cta: false, media: false, formTarget: false, maxItems: 6 },
  'problem-solution': { kind: 'problem-solution', variants: ['two-column', 'stacked'], textFields: ['heading', 'problem', 'solution'], cta: false, media: false, formTarget: false, maxItems: 0 },
  benefits: { kind: 'benefits', variants: ['grid-3', 'list'], textFields: ['eyebrow', 'heading', 'intro'], cta: false, media: false, formTarget: false, maxItems: 6 },
  process: { kind: 'process', variants: ['steps', 'timeline'], textFields: ['heading', 'intro'], cta: true, media: false, formTarget: false, maxItems: 5 },
  pricing: { kind: 'pricing', variants: ['request', 'tiers', 'single'], textFields: ['heading', 'intro', 'note'], cta: true, media: false, formTarget: false, maxItems: 3 },
  faq: { kind: 'faq', variants: ['accordion', 'two-column'], textFields: ['heading'], cta: false, media: false, formTarget: false, maxItems: 8 },
  contact: { kind: 'contact', variants: ['card', 'inline'], textFields: ['heading', 'body', 'phone', 'email', 'address'], cta: true, media: false, formTarget: false, maxItems: 0 },
  'lead-form': { kind: 'lead-form', variants: ['short', 'detailed'], textFields: ['heading', 'intro', 'submitLabel', 'consentNote'], cta: false, media: false, formTarget: true, maxItems: 0 },
  'case-study': { kind: 'case-study', variants: ['quote', 'story'], textFields: ['heading', 'quote', 'attribution', 'body'], cta: false, media: true, formTarget: false, maxItems: 0 },
  'compliance-block': { kind: 'compliance-block', variants: ['statement', 'badges'], textFields: ['heading', 'body'], cta: false, media: false, formTarget: false, maxItems: 4 },
  'automation-block': { kind: 'automation-block', variants: ['steps', 'grid'], textFields: ['heading', 'intro'], cta: true, media: false, formTarget: false, maxItems: 4 },
});

export const MAX_TEXT_LENGTH = 600;
export const MAX_ITEM_TEXT_LENGTH = 400;

/** Baut eine Komponente mit geprüften Defaults. Unbekannte Felder werden verworfen. */
export function createComponent(kind: RebuildComponentKind, id: string, init: Partial<Omit<RebuildComponent, 'id' | 'kind'>> = {}): RebuildComponent {
  const spec = COMPONENT_CATALOG[kind];
  const variant = init.variant && spec.variants.includes(init.variant) ? init.variant : spec.variants[0];
  const text: Record<string, string> = {};
  for (const field of spec.textFields) {
    const value = init.text?.[field];
    if (typeof value === 'string' && value.trim() !== '') text[field] = clip(value, MAX_TEXT_LENGTH);
  }
  return {
    id,
    kind,
    visible: init.visible ?? true,
    variant,
    text,
    items: (init.items ?? []).slice(0, spec.maxItems).map((item) => ({ title: clip(item.title, 120), text: clip(item.text, MAX_ITEM_TEXT_LENGTH), evidenceId: item.evidenceId ?? null })),
    cta: spec.cta ? sanitizeCta(init.cta ?? null) : null,
    media: spec.media ? sanitizeMedia(init.media ?? null) : null,
    formTarget: spec.formTarget ? sanitizeTarget(init.formTarget ?? null) : null,
    placeholder: init.placeholder ?? false,
  };
}

export function sanitizeCta(cta: RebuildCta | null): RebuildCta | null {
  if (!cta) return null;
  const label = clip(String(cta.label ?? ''), 60).trim();
  const href = String(cta.href ?? '').trim();
  if (!label || !isSafeHref(href)) return null;
  return { label, href, origin: cta.origin === 'import' ? 'import' : 'proposed' };
}

export function sanitizeMedia(media: RebuildMedia | null): RebuildMedia | null {
  if (!media) return null;
  const src = media.src === null ? null : String(media.src).trim();
  if (src !== null && !/^https?:\/\//i.test(src)) return null;
  return { src, alt: media.alt === null ? null : clip(String(media.alt), 200), origin: src === null ? 'none' : media.origin === 'import' ? 'import' : 'none' };
}

export function sanitizeTarget(target: string | null): string | null {
  if (target === null) return null;
  const value = String(target).trim();
  if (value === '') return null;
  // Nur absolute HTTPS-Ziele oder mailto: — ein Formular, das an
  // `javascript:` oder einen relativen Pfad einer fremden Site postet,
  // ist kein Formularziel.
  return /^https:\/\/[^\s]+$/i.test(value) || /^mailto:[^\s@]+@[^\s@]+$/i.test(value) ? value : null;
}

function isSafeHref(href: string): boolean {
  if (href.startsWith('#') || (href.startsWith('/') && !href.startsWith('//'))) return true;
  return /^(?:https?:\/\/|tel:|mailto:)/i.test(href);
}

export function clip(value: string, max: number): string {
  const v = value.replace(/\s+/g, ' ').trim();
  return v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v;
}

// ─────────────────────────────────────────────────────────────────────
// Operationen
// ─────────────────────────────────────────────────────────────────────

export interface OperationResult {
  direction: RebuildDirection;
  changes: RevisionChange[];
  rejected: string[];
}

/**
 * Wendet Editor-Operationen an. Unbekannte IDs, Felder außerhalb des
 * Katalogs und ungültige Werte werden als `rejected` gemeldet, der Rest
 * wird angewandt. Die Reihenfolge ist Teil des Ergebnisses.
 */
export function applyComponentOperations(direction: RebuildDirection, operations: ComponentOperation[]): OperationResult {
  let components = direction.components.map((c) => ({ ...c, text: { ...c.text }, items: c.items.map((i) => ({ ...i })) }));
  const changes: RevisionChange[] = [];
  const rejected: string[] = [];

  for (const op of operations) {
    const index = components.findIndex((c) => c.id === op.id);
    if (index === -1) { rejected.push(`${op.op}: unbekannte Komponente ${op.id}`); continue; }
    const current = components[index];
    const spec = COMPONENT_CATALOG[current.kind];

    switch (op.op) {
      case 'set-text': {
        if (!spec.textFields.includes(op.field)) { rejected.push(`set-text: Feld ${op.field} gibt es an ${current.kind} nicht`); break; }
        const value = clip(String(op.value ?? ''), MAX_TEXT_LENGTH);
        if (value === '') delete current.text[op.field]; else current.text[op.field] = value;
        // Wer den Text schreibt, füllt den Platzhalter.
        if (op.field === 'headline' || op.field === 'heading' || op.field === 'quote') current.placeholder = false;
        changes.push({ code: `component.text.${current.kind}.${op.field}`, summary: `${current.kind}: ${op.field} geändert.`, scope: 'copy' });
        break;
      }
      case 'set-item': {
        if (op.index < 0 || op.index > Math.min(current.items.length, spec.maxItems - 1)) { rejected.push(`set-item: Index ${op.index} außerhalb (max ${spec.maxItems})`); break; }
        const item = { title: clip(String(op.title ?? ''), 120), text: clip(String(op.text ?? ''), MAX_ITEM_TEXT_LENGTH), evidenceId: null };
        if (op.index === current.items.length) current.items.push(item); else current.items[op.index] = item;
        current.placeholder = false;
        changes.push({ code: `component.item.${current.kind}`, summary: `${current.kind}: Eintrag ${op.index + 1} geändert.`, scope: 'copy' });
        break;
      }
      case 'move': {
        const to = Math.max(0, Math.min(components.length - 1, Math.trunc(op.to)));
        if (to === index) break;
        const [moved] = components.splice(index, 1);
        components.splice(to, 0, moved);
        changes.push({ code: 'component.move', summary: `${moved.kind} an Position ${to + 1} verschoben.`, scope: 'structure' });
        break;
      }
      case 'set-visible': {
        if (current.kind === 'hero' && !op.visible) { rejected.push('set-visible: der Hero bleibt sichtbar'); break; }
        current.visible = Boolean(op.visible);
        changes.push({ code: 'component.visible', summary: `${current.kind} ${current.visible ? 'eingeblendet' : 'ausgeblendet'}.`, scope: 'structure' });
        break;
      }
      case 'set-variant': {
        if (!spec.variants.includes(op.variant)) { rejected.push(`set-variant: ${op.variant} ist keine Variante von ${current.kind} (${spec.variants.join(', ')})`); break; }
        current.variant = op.variant;
        changes.push({ code: `component.variant.${current.kind}`, summary: `${current.kind}: Variante ${op.variant}.`, scope: 'design' });
        break;
      }
      case 'set-cta': {
        if (!spec.cta) { rejected.push(`set-cta: ${current.kind} trägt keinen CTA`); break; }
        const cta = sanitizeCta(op.cta);
        if (op.cta && !cta) { rejected.push('set-cta: Beschriftung oder Ziel ungültig'); break; }
        current.cta = cta;
        changes.push({ code: `component.cta.${current.kind}`, summary: cta ? `${current.kind}: CTA „${cta.label}".` : `${current.kind}: CTA entfernt.`, scope: 'copy' });
        break;
      }
      case 'set-media': {
        if (!spec.media) { rejected.push(`set-media: ${current.kind} trägt kein Bild`); break; }
        const media = sanitizeMedia(op.media);
        if (op.media && op.media.src && !media?.src) { rejected.push('set-media: nur https-Bildquellen'); break; }
        current.media = media;
        changes.push({ code: `component.media.${current.kind}`, summary: media?.src ? `${current.kind}: Bild gesetzt.` : `${current.kind}: Bild entfernt.`, scope: 'design' });
        break;
      }
      case 'set-form-target': {
        if (!spec.formTarget) { rejected.push(`set-form-target: ${current.kind} hat kein Formularziel`); break; }
        const target = sanitizeTarget(op.formTarget);
        if (op.formTarget && !target) { rejected.push('set-form-target: nur https- oder mailto-Ziele'); break; }
        current.formTarget = target;
        changes.push({ code: 'component.form-target', summary: target ? 'Formularziel gesetzt.' : 'Formularziel entfernt.', scope: 'structure' });
        break;
      }
    }
  }

  // Formularziel gilt auch für den Lead-Flow — eine Wahrheit, nicht zwei.
  const lead = components.find((c) => c.kind === 'lead-form');
  const leadFlow = lead ? { ...direction.leadFlow, formTarget: lead.formTarget, requiresConfiguration: lead.formTarget === null } : direction.leadFlow;

  return { direction: { ...direction, components, leadFlow }, changes, rejected };
}

/** Sichtbare Komponenten in Reihenfolge. */
export function visibleComponents(direction: RebuildDirection): RebuildComponent[] {
  return direction.components.filter((c) => c.visible);
}

export function findComponent(direction: RebuildDirection, kind: RebuildComponentKind): RebuildComponent | undefined {
  return direction.components.find((c) => c.kind === kind);
}
