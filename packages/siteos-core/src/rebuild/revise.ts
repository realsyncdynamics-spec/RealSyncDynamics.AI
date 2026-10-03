// REFINE — Klartext-Anweisung → gezielte Änderung an Copy, Struktur, Design.
//
// „seriöser", „mehr Vertrauen", „weniger Startup, mehr Mittelstand",
// „mehr lokal", „CTA stärker", „Hero kürzer", „mehr wie Premium-Beratung",
// „für Handwerker", „für Steuerberater", „für KI-Governance".
//
// ## Warum deterministisch
//
// Dieselbe Begründung wie in `blueprint/refine.ts`: Eine Revision ändert
// eine Richtung, die der Kunde gesehen hat. Sie darf nur tun, was benannt
// ist — und muss sagen, was sie getan hat. Ein Modell darf davor sitzen
// und freie Sprache in diese Absichten übersetzen; es darf die Richtung
// nicht selbst umschreiben.
//
// Jede Absicht ist ein benanntes Bündel aus Copy-, Struktur- und
// Design-Operationen. Nichts wird „neu gewürfelt": Wer „seriöser" sagt,
// bekommt kleinere Radien, ruhigere Bewegung, engere Typografie und Text
// ohne Ausrufezeichen — und behält alles andere.

import { INDUSTRY_PRESETS } from '../blueprint/industries.ts';
import { meetsWcagAA } from '../render/theme.ts';
import type { IndustryKey } from '../types.ts';
import { applyComponentOperations, clip } from './components.ts';
import { deriveDesignSystem, desaturate, shiftLightness } from './design-system.ts';
import { limitWords } from './directions.ts';
import { normalizeHex } from './extract.ts';
import type { ComponentOperation, DesignSystem, RebuildComponent, RebuildComponentKind, RebuildDirection, RevisionChange, RevisionResult } from './types.ts';

// ─────────────────────────────────────────────────────────────────────
// Absichten
// ─────────────────────────────────────────────────────────────────────

export type RevisionIntent =
  | 'more-serious'
  | 'more-trust'
  | 'less-startup-more-mittelstand'
  | 'more-local'
  | 'stronger-cta'
  | 'shorter-hero'
  | 'premium-advisory'
  | 'for-handwerk'
  | 'for-steuerberater'
  | 'for-ki-governance'
  | 'mode-dark'
  | 'mode-light'
  | 'rounder'
  | 'sharper'
  | 'accent-color';

const INTENT_PATTERNS: ReadonlyArray<{ intent: RevisionIntent; pattern: RegExp }> = [
  { intent: 'less-startup-more-mittelstand', pattern: /weniger\s+start-?up|mehr\s+mittelstand|mittelständisch|bodenständig/i },
  { intent: 'premium-advisory', pattern: /premium|hochwertig(?:er)?|exklusiv|beratung(?:s)?-?niveau|wie\s+(?:eine\s+)?(?:premium|top)-?beratung/i },
  { intent: 'for-handwerk', pattern: /für\s+handwerk|handwerker|handwerksbetrieb/i },
  { intent: 'for-steuerberater', pattern: /für\s+steuerberat|steuerberater|steuerkanzlei|kanzlei/i },
  { intent: 'for-ki-governance', pattern: /ki-?governance|ai\s*governance|eu\s*ai\s*act|governance/i },
  { intent: 'more-serious', pattern: /seriös(?:er)?|serioes(?:er)?|professionell(?:er)?|nüchtern(?:er)?|sachlich(?:er)?|weniger\s+verspielt/i },
  { intent: 'more-trust', pattern: /mehr\s+vertrauen|vertrauenswürdig(?:er)?|glaubwürdig(?:er)?|mehr\s+belege|mehr\s+proof/i },
  { intent: 'more-local', pattern: /mehr\s+lokal|lokaler|regional(?:er)?|vor\s+ort|mehr\s+nähe/i },
  { intent: 'stronger-cta', pattern: /cta\s+stärker|stärkere?[rn]?\s+cta|mehr\s+(?:conversion|abschluss)|call-?to-?action\s+(?:stärker|deutlicher)|deutlichere?[rn]?\s+(?:cta|aufforderung)/i },
  { intent: 'shorter-hero', pattern: /hero\s+kürzer|kürzere?[rn]?\s+hero|hero\s+knapper|weniger\s+text\s+(?:im|oben)|hero\s+kompakt/i },
  { intent: 'mode-dark', pattern: /\bdunkel(?:er)?\b|dark\s*mode|dunkles\s+(?:design|thema)/i },
  { intent: 'mode-light', pattern: /\bhell(?:er)?\b|light\s*mode|helles\s+(?:design|thema)/i },
  { intent: 'rounder', pattern: /runder|weicher|abgerundet/i },
  { intent: 'sharper', pattern: /eckig(?:er)?|kantig(?:er)?|schärfer|harte\s+kanten/i },
  { intent: 'accent-color', pattern: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/ },
];

/** Erkennt alle Absichten in einer Anweisung — in stabiler Reihenfolge. */
export function parseRevisionIntents(instruction: string): RevisionIntent[] {
  const found: RevisionIntent[] = [];
  for (const { intent, pattern } of INTENT_PATTERNS) {
    if (pattern.test(instruction) && !found.includes(intent)) found.push(intent);
  }
  // „hell" steckt in „hellblau" — dann ist die Farbe gemeint, nicht der Modus.
  if (found.includes('accent-color') && found.includes('mode-light') && /hellblau|hellgrün|hellgrau/i.test(instruction)) {
    found.splice(found.indexOf('mode-light'), 1);
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────
// Anwendung
// ─────────────────────────────────────────────────────────────────────

export interface ReviseContext {
  /** Ort aus dem Import — „mehr lokal" braucht ihn. */
  locality: string | null;
  /** Marke aus dem Import — zur Neuableitung des Design-Systems. */
  brand: Parameters<typeof deriveDesignSystem>[0];
}

export function reviseDirection(direction: RebuildDirection, instruction: string, context: ReviseContext): RevisionResult {
  const intents = parseRevisionIntents(instruction);
  if (intents.length === 0) {
    return { direction, changes: [], understood: false, refusals: [] };
  }

  let current = cloneDirection(direction);
  const changes: RevisionChange[] = [];
  const refusals: string[] = [];

  for (const intent of intents) {
    const result = applyIntent(current, intent, instruction, context);
    current = result.direction;
    changes.push(...result.changes);
    refusals.push(...result.refusals);
  }

  return { direction: current, changes, understood: changes.length > 0, refusals };
}

interface IntentResult {
  direction: RebuildDirection;
  changes: RevisionChange[];
  refusals: string[];
}

function applyIntent(d: RebuildDirection, intent: RevisionIntent, instruction: string, context: ReviseContext): IntentResult {
  const changes: RevisionChange[] = [];
  const refusals: string[] = [];
  let direction = d;
  const ds = { ...direction.designSystem };
  const push = (code: string, summary: string, scope: RevisionChange['scope']) => changes.push({ code, summary, scope });

  switch (intent) {
    case 'more-serious': {
      direction = withDesign(direction, {
        radius: { sm: Math.min(ds.radius.sm, 4), md: Math.min(ds.radius.md, 6), lg: Math.min(ds.radius.lg, 10) },
        buttons: { ...ds.buttons, radius: Math.min(ds.buttons.radius, 6), weight: 600 },
        cards: { ...ds.cards, shadow: 'none', radius: Math.min(ds.cards.radius, 10) },
        motion: { ...ds.motion, allow: ['fade'], durationMs: Math.max(ds.motion.durationMs, 280) },
        colors: { ...ds.colors, primary: desaturate(ds.colors.primary, 0.12), accent: desaturate(ds.colors.accent, 0.12), origin: ds.colors.origin === 'brand' ? 'derived' : ds.colors.origin },
      });
      push('design.serious', 'Radien reduziert, Schatten entfernt, Farben leicht entsättigt, Bewegung ruhiger.', 'design');
      direction = mapText(direction, (value) => value.replace(/!+/g, '.').replace(/\bJetzt\s+/g, ''), () => push('copy.serious', 'Ausrufezeichen und „Jetzt" aus der Copy entfernt.', 'copy'));
      direction = { ...direction, tone: Math.max(0, direction.tone - 20) };
      break;
    }
    case 'more-trust': {
      const ops: ComponentOperation[] = [];
      const trust = find(direction, 'trust-bar');
      const cs = find(direction, 'case-study');
      const comp = find(direction, 'compliance-block');
      if (trust) { ops.push({ op: 'set-visible', id: trust.id, visible: true }, { op: 'move', id: trust.id, to: 1 }); if (trust.variant === 'quiet') ops.push({ op: 'set-variant', id: trust.id, variant: 'facts' }); }
      if (cs) ops.push({ op: 'set-visible', id: cs.id, visible: true });
      if (comp) ops.push({ op: 'set-visible', id: comp.id, visible: true });
      const applied = applyComponentOperations(direction, ops);
      direction = applied.direction;
      push('structure.trust', 'Trust Bar direkt unter den Hero, Referenz und Compliance-Block eingeblendet.', 'structure');
      if (trust?.placeholder) refusals.push('Es gibt keine belegten Trust-Signale in der Quelle — der Block bleibt Platzhalter, es werden keine erfunden.');
      break;
    }
    case 'less-startup-more-mittelstand': {
      direction = withDesign(direction, {
        typography: { ...ds.typography, display: { ...ds.typography.display, family: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', weight: 700, letterSpacing: '-0.01em' }, body: { ...ds.typography.body, family: '"Source Sans 3", system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }, origin: 'derived' },
        radius: { sm: 4, md: 6, lg: 10 },
        buttons: { ...ds.buttons, radius: 6, weight: 600 },
        cards: { ...ds.cards, shadow: 'none', radius: 10 },
        colors: { ...ds.colors, primary: desaturate(ds.colors.primary, 0.18), accent: desaturate(ds.colors.accent, 0.18), origin: ds.colors.origin === 'brand' ? 'derived' : ds.colors.origin },
        motion: { ...ds.motion, allow: ['fade'] },
      });
      push('design.mittelstand', 'Neutrale Schrift, kleine Radien, keine Schatten, gedämpfte Farben.', 'design');
      direction = mapText(direction, (value) => value
        .replace(/\bPlattform\b/g, 'Lösung')
        .replace(/\bskalier\w*/gi, 'wachsen')
        .replace(/\bdisruptiv\w*/gi, 'verlässlich')
        .replace(/\bGame[- ]?Changer\b/gi, 'Verbesserung')
        .replace(/\bJetzt\s+durchstarten\b/gi, 'Anfrage senden')
        .replace(/\b(?:revolutionär|bahnbrechend|next[- ]level)\w*/gi, 'bewährt'), () => push('copy.mittelstand', 'Startup-Vokabular durch sachliche Begriffe ersetzt.', 'copy'));
      direction = { ...direction, tone: Math.max(0, direction.tone - 10) };
      break;
    }
    case 'more-local': {
      const ops: ComponentOperation[] = [];
      const contact = find(direction, 'contact');
      const hero = find(direction, 'hero');
      if (contact) { ops.push({ op: 'set-visible', id: contact.id, visible: true }); ops.push({ op: 'move', id: contact.id, to: Math.min(3, direction.components.length - 1) }); if (contact.variant !== 'card') ops.push({ op: 'set-variant', id: contact.id, variant: 'card' }); }
      if (hero && hero.variant !== 'split') ops.push({ op: 'set-variant', id: hero.id, variant: 'split' });
      if (context.locality && hero) {
        const headline = hero.text.headline ?? '';
        if (!headline.includes(context.locality)) ops.push({ op: 'set-text', id: hero.id, field: 'headline', value: clip(`${headline} in ${context.locality}`, 120) });
        const eyebrow = hero.text.eyebrow ?? '';
        if (!eyebrow.includes(context.locality)) ops.push({ op: 'set-text', id: hero.id, field: 'eyebrow', value: clip(`${eyebrow ? `${eyebrow} · ` : ''}${context.locality}`, 80) });
      } else {
        refusals.push('Der Ort ist aus der Quelle nicht bekannt — bitte im Hero eintragen, er wird nicht geraten.');
      }
      direction = applyComponentOperations(direction, ops).direction;
      push('structure.local', 'Kontakt nach oben, Hero als Split mit Ort im Text.', 'structure');
      direction = { ...direction, tone: Math.min(100, direction.tone + 20) };
      break;
    }
    case 'stronger-cta': {
      direction = withDesign(direction, {
        buttons: { ...ds.buttons, height: Math.max(ds.buttons.height, 52), weight: 700, paddingX: Math.max(ds.buttons.paddingX, 26) },
        colors: { ...ds.colors, primary: ensureVivid(ds.colors.primary), origin: ds.colors.origin === 'brand' ? 'derived' : ds.colors.origin },
      });
      const ops: ComponentOperation[] = [];
      const lead = find(direction, 'lead-form');
      const hero = find(direction, 'hero');
      if (lead) { ops.push({ op: 'set-visible', id: lead.id, visible: true }, { op: 'move', id: lead.id, to: Math.min(3, direction.components.length - 1) }); }
      const stronger = strongerLabel(direction.primaryCta.label);
      if (hero) ops.push({ op: 'set-cta', id: hero.id, cta: { ...direction.primaryCta, label: stronger } });
      if (lead) ops.push({ op: 'set-text', id: lead.id, field: 'submitLabel', value: stronger });
      direction = { ...applyComponentOperations(direction, ops).direction, primaryCta: { ...direction.primaryCta, label: stronger } };
      push('cta.stronger', `Primär-CTA „${stronger}", Buttons größer, Formular nach oben.`, 'copy');
      break;
    }
    case 'shorter-hero': {
      const hero = find(direction, 'hero');
      if (!hero) break;
      const ops: ComponentOperation[] = [];
      if (hero.text.headline) ops.push({ op: 'set-text', id: hero.id, field: 'headline', value: limitWords(hero.text.headline, 8) });
      if (hero.text.subline) ops.push({ op: 'set-text', id: hero.id, field: 'subline', value: limitWords(hero.text.subline, 18) });
      if (hero.variant !== 'centered') ops.push({ op: 'set-variant', id: hero.id, variant: 'centered' });
      direction = applyComponentOperations(direction, ops).direction;
      push('hero.shorter', 'Hero auf acht Wörter Überschrift und 18 Wörter Subline gekürzt.', 'copy');
      break;
    }
    case 'premium-advisory': {
      direction = { ...direction, designSystem: deriveDesignSystem(context.brand, 'premium-advisory') };
      const ops: ComponentOperation[] = [];
      const pricing = find(direction, 'pricing');
      const ps = find(direction, 'problem-solution');
      const hero = find(direction, 'hero');
      if (pricing) ops.push({ op: 'set-visible', id: pricing.id, visible: false });
      if (ps) { ops.push({ op: 'set-visible', id: ps.id, visible: true }, { op: 'move', id: ps.id, to: 1 }, { op: 'set-variant', id: ps.id, variant: 'stacked' }); }
      if (hero) ops.push({ op: 'set-variant', id: hero.id, variant: 'statement' });
      direction = applyComponentOperations(direction, ops).direction;
      direction = mapText(direction, (value) => value.replace(/!+/g, '.').replace(/\bJetzt\s+/g, '').replace(/\bkostenlos\b/gi, 'unverbindlich'), () => push('copy.premium', 'Copy zurückgenommen: keine Ausrufezeichen, „kostenlos" → „unverbindlich".', 'copy'));
      push('design.premium', 'Premium-Profil: Serifen-Überschriften, kleine Radien, ohne Wechselflächen, ruhige Bewegung.', 'design');
      direction = { ...direction, tone: Math.max(0, Math.min(direction.tone, 15)) };
      break;
    }
    case 'for-handwerk':
      direction = retarget(direction, 'handwerk', 'Handwerksbetriebe', context, push);
      break;
    case 'for-steuerberater':
      direction = retarget(direction, 'steuerberatung', 'Steuerberater und Kanzleien', context, push);
      break;
    case 'for-ki-governance': {
      direction = { ...direction, designSystem: deriveDesignSystem(context.brand, 'governance-first') };
      const ops: ComponentOperation[] = [];
      const comp = find(direction, 'compliance-block');
      const auto = find(direction, 'automation-block');
      const hero = find(direction, 'hero');
      if (comp) ops.push({ op: 'set-visible', id: comp.id, visible: true }, { op: 'move', id: comp.id, to: 1 }, { op: 'set-variant', id: comp.id, variant: 'badges' });
      if (auto) ops.push({ op: 'set-visible', id: auto.id, visible: true }, { op: 'move', id: auto.id, to: 3 });
      if (hero) ops.push({ op: 'set-text', id: hero.id, field: 'eyebrow', value: 'DSGVO · EU AI Act · nachvollziehbar' });
      direction = applyComponentOperations(direction, ops).direction;
      push('structure.governance', 'Compliance-Block und Automatisierung nach oben, Governance-Profil aktiviert.', 'structure');
      direction = { ...direction, tone: Math.min(direction.tone, 30) };
      break;
    }
    case 'mode-dark':
    case 'mode-light': {
      const mode = intent === 'mode-dark' ? 'dark' : 'light';
      if (direction.designSystem.mode === mode) break;
      direction = { ...direction, designSystem: { ...deriveDesignSystem(context.brand, direction.key, { mode }), radius: ds.radius, buttons: { ...deriveDesignSystem(context.brand, direction.key, { mode }).buttons, height: ds.buttons.height, weight: ds.buttons.weight } } };
      push(`design.mode.${mode}`, mode === 'dark' ? 'Dunkler Modus — ausdrücklich gewählt.' : 'Heller Modus.', 'design');
      break;
    }
    case 'rounder': {
      direction = withDesign(direction, { radius: { sm: ds.radius.sm + 4, md: ds.radius.md + 6, lg: ds.radius.lg + 8 }, buttons: { ...ds.buttons, radius: ds.buttons.radius + 6 }, cards: { ...ds.cards, radius: ds.cards.radius + 8 } });
      push('design.rounder', 'Radien vergrößert.', 'design');
      break;
    }
    case 'sharper': {
      direction = withDesign(direction, { radius: { sm: 0, md: 0, lg: 0 }, buttons: { ...ds.buttons, radius: 0 }, cards: { ...ds.cards, radius: 0 } });
      push('design.sharper', 'Harte Kanten: alle Radien auf 0.', 'design');
      break;
    }
    case 'accent-color': {
      const hex = normalizeHex(/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.exec(instruction)?.[0] ?? '');
      if (!hex) break;
      if (!meetsWcagAA('#FFFFFF', hex)) {
        refusals.push(`${hex} erreicht mit weißer Schrift keine 4.5:1 — als Primärfarbe abgelehnt. Eine dunklere Variante wählen.`);
        break;
      }
      direction = withDesign(direction, { colors: { ...ds.colors, primary: hex, accent: shiftLightness(hex, -0.12), origin: 'derived' }, buttons: { ...ds.buttons, primary: { background: hex, foreground: '#FFFFFF', border: hex }, secondary: { ...ds.buttons.secondary, foreground: ds.mode === 'dark' ? ds.colors.foreground : hex, border: ds.mode === 'dark' ? ds.colors.border : hex } }, forms: { ...ds.forms, focusRing: hex } });
      push('design.accent', `Primärfarbe ${hex}.`, 'design');
      break;
    }
  }

  return { direction, changes, refusals };
}

// ─────────────────────────────────────────────────────────────────────
// Hilfen
// ─────────────────────────────────────────────────────────────────────

function retarget(d: RebuildDirection, industry: IndustryKey, audience: string, context: ReviseContext, push: (code: string, summary: string, scope: RevisionChange['scope']) => void): RebuildDirection {
  const key = industry === 'steuerberatung' ? 'premium-advisory' : 'local-trust';
  let direction: RebuildDirection = { ...d, designSystem: deriveDesignSystem(context.brand, key) };
  const ops: ComponentOperation[] = [];
  const hero = find(direction, 'hero');
  const process = find(direction, 'process');
  const pricing = find(direction, 'pricing');
  const comp = find(direction, 'compliance-block');
  const label = INDUSTRY_PRESETS[industry].label;
  if (hero) {
    ops.push({ op: 'set-text', id: hero.id, field: 'eyebrow', value: `Für ${audience}` });
    // Eine frühere Zielgruppen-Ansprache wird ersetzt, nicht gestapelt.
    const subline = (hero.text.subline ?? '').replace(/^Für [^.]+\.\s*/u, '');
    if (!subline.toLowerCase().includes(audience.toLowerCase().split(' ')[0])) ops.push({ op: 'set-text', id: hero.id, field: 'subline', value: clip(`Für ${audience}. ${subline}`, 400) });
  }
  if (industry === 'handwerk') {
    if (process) ops.push({ op: 'set-variant', id: process.id, variant: 'timeline' });
    if (pricing) ops.push({ op: 'set-visible', id: pricing.id, visible: true });
    direction = { ...direction, tone: Math.min(100, direction.tone + 15) };
  } else {
    if (comp) ops.push({ op: 'set-visible', id: comp.id, visible: true });
    if (pricing) ops.push({ op: 'set-visible', id: pricing.id, visible: false });
    direction = { ...direction, tone: Math.max(0, direction.tone - 15) };
  }
  direction = applyComponentOperations(direction, ops).direction;
  push(`audience.${industry}`, `Zielgruppe „${audience}" (${label}): Hero-Ansprache, Ablauf und Blöcke angepasst.`, 'copy');
  return direction;
}

function strongerLabel(label: string): string {
  const map: Record<string, string> = {
    'kontakt aufnehmen': 'Anfrage senden',
    'unverbindlich anfragen': 'Angebot anfordern',
    'termin vereinbaren': 'Termin anfragen',
    'erstgespräch anfragen': 'Erstgespräch sichern',
    'rückruf anfragen': 'Rückruf anfordern',
  };
  return map[label.toLowerCase()] ?? label;
}

function ensureVivid(hex: string): string {
  // Kräftiger, aber innerhalb der Kontrastregel — der Button muss lesbar bleiben.
  const candidate = shiftLightness(hex, -0.04);
  return meetsWcagAA('#FFFFFF', candidate) ? candidate : hex;
}

function withDesign(d: RebuildDirection, patch: Partial<DesignSystem>): RebuildDirection {
  return { ...d, designSystem: { ...d.designSystem, ...patch } };
}

function find(d: RebuildDirection, kind: RebuildComponentKind): RebuildComponent | undefined {
  return d.components.find((c) => c.kind === kind);
}

function mapText(d: RebuildDirection, fn: (value: string) => string, onChange: () => void): RebuildDirection {
  let changed = false;
  const components = d.components.map((c) => {
    const text: Record<string, string> = {};
    for (const [k, v] of Object.entries(c.text)) {
      const next = fn(v);
      if (next !== v) changed = true;
      text[k] = next;
    }
    const items = c.items.map((i) => {
      const t = fn(i.text);
      const title = fn(i.title);
      if (t !== i.text || title !== i.title) changed = true;
      return { ...i, text: t, title };
    });
    const cta = c.cta ? { ...c.cta, label: fn(c.cta.label) } : null;
    if (cta && c.cta && cta.label !== c.cta.label) changed = true;
    return { ...c, text, items, cta };
  });
  if (changed) onChange();
  return changed ? { ...d, components } : d;
}

function cloneDirection(d: RebuildDirection): RebuildDirection {
  return {
    ...d,
    designSystem: { ...d.designSystem, colors: { ...d.designSystem.colors }, typography: { ...d.designSystem.typography }, radius: { ...d.designSystem.radius }, buttons: { ...d.designSystem.buttons }, cards: { ...d.designSystem.cards }, motion: { ...d.designSystem.motion, allow: [...d.designSystem.motion.allow] } },
    components: d.components.map((c) => ({ ...c, text: { ...c.text }, items: c.items.map((i) => ({ ...i })), cta: c.cta ? { ...c.cta } : null, media: c.media ? { ...c.media } : null })),
    leadFlow: { ...d.leadFlow, fields: d.leadFlow.fields.map((f) => ({ ...f })) },
    proof: d.proof.map((p) => ({ ...p })),
  };
}
