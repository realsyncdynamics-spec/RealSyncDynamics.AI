// Puck-Konfiguration für den SiteOS-Block-Editor.
//
// Jede Block-Art des Blueprints ist eine Puck-Komponente. Ihre Felder kommen
// aus `EDITABLE_CONTENT` (siteos-core) — dieselbe Liste, gegen die der Server
// eine Bearbeitung bereinigt. Was dort nicht steht, zeigt der Editor nicht an.
//
// Gerendert wird **nicht** mit eigenen React-Bausteinen, sondern mit dem
// Renderer des Kerns (`renderBlockHtml`): Die Leinwand zeigt das Markup, das
// ausgeliefert würde. Ein zweiter Satz Bausteine wäre die Stelle, an der
// Vorschau und Website auseinanderliefen.

import type { ReactElement } from 'react';
import type { Config, Field, Fields } from '@puckeditor/core';
import {
  ADDABLE_KINDS,
  EDITABLE_CONTENT,
  FORM_FIELD_NAMES,
  briefFromBlueprint,
  buildBlock,
  isPinnedKind,
  labelFor,
  renderBlockHtml,
  type BlockKind,
  type FieldShape,
  type SiteBlueprint,
} from '../../../../packages/siteos-core/src/index';
import { blockToProps, propsToBlock, type BlockProps } from './blueprintPuckAdapter';
import { BLOCK_WRAPPER_ATTR } from './editorCss';

/** Was der Editor jedem Block beim Rendern mitgibt (Puck: `metadata`). */
export interface CanvasMetadata {
  /** Der Blueprint mit angewandter Design-Vorlage — für Theme-Werte und Namen. */
  blueprint: SiteBlueprint;
  /** Überschriftenebene je Block-ID, aus `renderPageBlocks` der aktuellen Seite. */
  headings: Record<string, 'h1' | 'h2'>;
}

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  brand: 'Wortmarke',
  links: 'Links',
  label: 'Bezeichnung',
  href: 'Link',
  headline: 'Überschrift',
  subline: 'Unterzeile',
  primaryCta: 'Schaltfläche',
  emphasis: 'Höhe',
  heading: 'Überschrift',
  items: 'Einträge',
  description: 'Beschreibung',
  body: 'Text',
  members: 'Mitglieder',
  name: 'Name',
  quote: 'Zitat',
  question: 'Frage',
  answer: 'Antwort',
  fields: 'Formularfelder',
  consentText: 'Einwilligungstext',
  eyebrow: 'Dachzeile',
  secondaryCta: 'Zweite Schaltfläche',
  proof: 'Nachweiszeile',
  variant: 'Stilvariante',
  media: 'Bild',
  src: 'Bildadresse',
  alt: 'Alternativtext',
  rightsConfirmed: 'Nutzungsrechte bestätigt',
  hidden: 'Ausgeblendet',
  cta: 'Schaltfläche im Kopf',
  intro: 'Einleitung',
  submitLabel: 'Beschriftung Absenden',
  target: 'Formularziel (https:// oder mailto:)',
  author: 'Quelle / Person',
  problem: 'Ausgangslage',
  solution: 'Lösung',
  points: 'Punkte',
  steps: 'Schritte',
  title: 'Titel',
  text: 'Text',
  price: 'Preis',
  note: 'Hinweis',
  phone: 'Telefon',
  phoneHref: 'Telefon-Link (tel:)',
  email: 'E-Mail',
  address: 'Anschrift',
  hours: 'Erreichbarkeit',
});

const FORM_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  name: 'Name',
  email: 'E-Mail-Adresse',
  phone: 'Telefonnummer',
  message: 'Nachricht',
  slot: 'Wunschtermin',
});

const EMPHASIS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  '': 'Standard',
  compact: 'Kompakt',
  tall: 'Hoch',
  // Stilvarianten der Rebuild-Komponenten
  split: 'Zweispaltig',
  centered: 'Zentriert',
  editorial: 'Redaktionell',
  cards: 'Karten',
  numbered: 'Nummeriert',
  list: 'Liste',
  standard: 'Standard',
  lead: 'Anfrage (Lead)',
  newsletter: 'Newsletter',
  band: 'Band',
  card: 'Karte',
});

function labelOf(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

/** Übersetzt eine Feldform aus dem Kern in ein Puck-Feld. */
export function toPuckField(key: string, shape: FieldShape): Field {
  const label = labelOf(key);
  switch (shape.type) {
    case 'text':
    case 'url':
      return { type: 'text', label };
    case 'textarea':
      return { type: 'textarea', label };
    case 'enum':
      return {
        type: 'select',
        label,
        options: [
          ...(shape.optional ? [{ label: EMPHASIS_LABELS[''], value: '' }] : []),
          ...shape.values.map((value) => ({ label: EMPHASIS_LABELS[value] ?? value, value })),
        ],
      };
    case 'object':
      return {
        type: 'object',
        label,
        objectFields: Object.fromEntries(Object.entries(shape.fields).map(([k, s]) => [k, toPuckField(k, s)])),
      };
    case 'list': {
      const firstKey = Object.keys(shape.item)[0];
      return {
        type: 'array',
        label,
        max: shape.max,
        arrayFields: Object.fromEntries(Object.entries(shape.item).map(([k, s]) => [k, toPuckField(k, s)])),
        defaultItemProps: Object.fromEntries(Object.keys(shape.item).map((k) => [k, ''])),
        getItemSummary: (item: Record<string, unknown>, index?: number) => {
          const value = item[firstKey];
          return typeof value === 'string' && value.trim() !== '' ? value : `${label} ${(index ?? 0) + 1}`;
        },
      };
    }
    case 'boolean':
      return {
        type: 'radio',
        label,
        options: [
          { label: 'Nein', value: false },
          { label: 'Ja', value: true },
        ],
      };
    case 'form-fields':
      return {
        type: 'array',
        label,
        max: FORM_FIELD_NAMES.length,
        arrayFields: {
          name: {
            type: 'select',
            label: 'Feld',
            options: FORM_FIELD_NAMES.map((name) => ({ label: FORM_FIELD_LABELS[name] ?? name, value: name })),
          },
        },
        defaultItemProps: { name: 'name' },
        getItemSummary: (item: { name?: string }) => FORM_FIELD_LABELS[item.name ?? ''] ?? item.name ?? 'Feld',
      };
  }
}

/** Beschriftungen, die nur für einen Block-Typ gelten. */
const KIND_FIELD_LABELS: Readonly<Partial<Record<BlockKind, Record<string, string>>>> = Object.freeze({
  'legal-text': { body: 'Wortlaut (vom Verantwortlichen — RealSync erzeugt keine Rechtstexte)' },
});

function fieldsFor(kind: BlockKind): Fields<BlockProps> {
  return Object.fromEntries(
    Object.entries(EDITABLE_CONTENT[kind]).map(([key, shape]) => {
      const field = toPuckField(key, shape);
      const label = KIND_FIELD_LABELS[kind]?.[key];
      return [key, label ? { ...field, label } : field];
    }),
  ) as Fields<BlockProps>;
}

/**
 * Leinwand-Darstellung eines Blocks: das Markup des Kern-Renderers in einem
 * Wrapper, den das Leinwand-Stylesheet wie den Seitenrumpf gestaltet.
 */
function BlockCanvas({ kind, props, metadata }: { kind: BlockKind; props: BlockProps; metadata: CanvasMetadata }): ReactElement {
  const block = propsToBlock(kind, props);
  const heading = metadata.headings[block.id] ?? 'h2';
  const html = renderBlockHtml(metadata.blueprint, block, heading);
  const wrapperProps = { [BLOCK_WRAPPER_ATTR]: kind } as Record<string, string>;

  if (html === '') {
    // Der Renderer lässt leere Referenzlisten bewusst weg (§ 5 UWG) und
    // ausgeblendete Blöcke ganz. In der Leinwand bleibt der Block sichtbar,
    // damit klar ist, warum nichts erscheint — und wie er zurückkommt.
    const hidden = (block.content as { hidden?: unknown }).hidden === true;
    return (
      <div {...wrapperProps} style={{ padding: '1.5rem', border: '1px dashed currentColor', opacity: 0.6, fontSize: '.9rem' }}>
        {hidden
          ? `${labelFor(kind)}: ausgeblendet — wird nicht ausgeliefert. Zum Einblenden rechts „Ausgeblendet" auf „Nein" stellen.`
          : `${labelFor(kind)}: keine Einträge — dieser Block wird ohne Inhalt nicht ausgeliefert.`}
      </div>
    );
  }

  return <div {...wrapperProps} dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Baut die Konfiguration für einen Blueprint. Vorbelegungen neuer Blöcke
 * kommen aus `buildBlock` mit dem Brief dieser Site — derselbe Bauer, den
 * auch der Server nutzt, mit Rechtsgrundlage und Datenschutz-Link.
 */
export function createSiteOsPuckConfig(blueprint: SiteBlueprint): Config<Record<BlockKind, BlockProps>> {
  const brief = briefFromBlueprint(blueprint);
  const kinds = Object.keys(EDITABLE_CONTENT) as BlockKind[];

  const components = Object.fromEntries(kinds.map((kind) => {
    const template = blockToProps(buildBlock(kind, 0, '/', brief, false));
    // Die ID vergibt Puck beim Einfügen; die Vorlage darf keine mitbringen.
    const { id: _id, ...defaultProps } = template;
    void _id;
    const pinned = isPinnedKind(kind);
    return [kind, {
      label: labelFor(kind),
      fields: fieldsFor(kind),
      defaultProps: defaultProps as Omit<BlockProps, 'id'>,
      permissions: pinned ? { drag: false, delete: false, duplicate: false } : { duplicate: false },
      render: ({ puck, ...props }) => (
        <BlockCanvas kind={kind} props={props as unknown as BlockProps} metadata={puck.metadata as CanvasMetadata} />
      ),
    }];
  })) as Config<Record<BlockKind, BlockProps>>['components'];

  return {
    components,
    categories: {
      inhalt: { title: 'Bausteine', components: [...ADDABLE_KINDS], defaultExpanded: true },
      // Angeheftete Blöcke lassen sich nicht einfügen — sie sind auf jeder
      // Seite genau einmal da (Navigation, Fuß) oder folgen dem Bauplan.
      fest: { title: 'Fest', components: kinds.filter((k) => !ADDABLE_KINDS.includes(k)), visible: false },
    },
    root: {
      fields: {},
      render: ({ children }) => <>{children}</>,
    },
  };
}
