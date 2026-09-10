// Block-Editor für SiteOS auf Basis von Puck (@puckeditor/core, MIT).
//
// Kein eigener Editor: Auswahl, Ziehen, Einfügen, Felder, Verlauf kommen aus
// Puck. Eigen sind nur die drei Anschlüsse an SiteOS —
//
//   • Datenmodell: `blueprintPuckAdapter.ts` bildet `SitePage.blocks` auf
//     Puck-Daten ab und zurück auf eine `PageEdit`-Anfrage.
//   • Darstellung: jeder Block rendert über den Kern-Renderer
//     (`puckConfig.tsx`), das Leinwand-Stylesheet kommt aus `editorCss.ts`.
//   • Struktur: Navigation, Fuß, KI-Hinweis und Rechtstexte sind nicht
//     verschiebbar oder löschbar; das erzwingt der Kern (`applyPageEdits`),
//     Puck zeigt es nur an (`permissions`).
//
// Die Komponente ist bewusst lazy zu laden: Puck bringt Editor, Rich-Text
// und Drag-and-drop mit und gehört nicht in den kritischen Pfad.

import '@puckeditor/core/puck.css';
import { createContext, useContext, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from 'react';
import { Puck, type Data, type Overrides } from '@puckeditor/core';
import {
  applySiteDesignTemplate,
  renderPageBlocks,
  type SiteBlueprint,
  type SiteDesignTemplate,
} from '../../../../packages/siteos-core/src/index';
import { pageToPuckData, toPageEdit, type PuckPageData } from './blueprintPuckAdapter';
import { renderCanvasCss } from './editorCss';
import { createSiteOsPuckConfig, type CanvasMetadata } from './puckConfig';

export interface SiteOsBlockEditorProps {
  /** Der zuletzt gespeicherte Stand — Grundlage jeder Bearbeitung. */
  storedBlueprint: SiteBlueprint;
  /** Der Stand mit allen lokalen Bearbeitungen (für Leinwand und Struktur). */
  localBlueprint: SiteBlueprint;
  /** Design-Vorlage der Vorschau; wirkt nur auf das Stylesheet der Leinwand. */
  template: SiteDesignTemplate;
  pagePath: string;
  /** Puck-Daten der aktuellen Seite, falls sie schon bearbeitet wurde. */
  pageData?: PuckPageData;
  onPageDataChange: (pagePath: string, data: PuckPageData) => void;
  /** Breite der Leinwand, z. B. `100%`, `820px`, `390px`. */
  canvasWidth: string;
  /** Linke Spalte unter der Seitenstruktur (Design-Vorlagen der Seite). */
  asideLeft?: ReactNode;
  /** Rechte Spalte unter den Feldern (AI-Editor der Seite). */
  asideRight?: ReactNode;
  /** Kopfzeile über der Leinwand (Titel, Geräteumschalter, Vorschau-Schalter). */
  canvasHeader?: ReactNode;
  /** Schlüssel, der den Editor neu aufsetzt (z. B. nach einem KI-Neubau). */
  revision: number;
}

const CanvasCssContext = createContext<string>('');

/**
 * Hängt das Leinwand-Stylesheet in das Vorschau-iframe von Puck. Puck spiegelt
 * die Stylesheets der Anwendung dorthin (für seine eigenen Overlays); das
 * Site-Stylesheet folgt danach und gewinnt bei gleicher Spezifität. Tailwinds
 * Grundregeln liegen in `@layer base` und verlieren gegen ungeschichtete
 * Regeln ohnehin.
 */
function CanvasStyles({ children, document }: { children: ReactNode; document?: Document }): ReactElement {
  const css = useContext(CanvasCssContext);
  useEffect(() => {
    if (!document) return;
    let tag = document.getElementById('siteos-canvas-css') as HTMLStyleElement | null;
    if (!tag) {
      tag = document.createElement('style');
      tag.id = 'siteos-canvas-css';
      document.head.appendChild(tag);
    }
    if (tag.textContent !== css) tag.textContent = css;
    // Immer als letztes Stylesheet — Puck hängt gespiegelte Stylesheets
    // asynchron nach, und Reihenfolge entscheidet bei gleicher Spezifität.
    // Der Beobachter zieht das Site-Stylesheet nach jedem Nachzügler wieder
    // ans Ende; das Anhängen selbst löst nur dann eine Mutation aus, wenn es
    // nicht schon letztes Kind ist — kein Kreislauf.
    const keepLast = () => {
      if (tag && document.head.lastElementChild !== tag) document.head.appendChild(tag);
    };
    keepLast();
    const observer = new MutationObserver(keepLast);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [css, document]);
  return <>{children}</>;
}

const OVERRIDES: Partial<Overrides> = {
  iframe: CanvasStyles,
};

const DICTIONARY = {
  'header-publish': 'Speichern',
  'header-undo': 'Rückgängig',
  'header-redo': 'Wiederholen',
  'action-selectparent': 'Übergeordnetes auswählen',
  'action-duplicate': 'Duplizieren',
  'action-delete': 'Löschen',
  'label-page': 'Seite',
  'label-component': 'Baustein',
  'outline-empty': 'Keine Bausteine',
  'outline-item-collapse': 'Einklappen',
  'outline-item-expand': 'Ausklappen',
  'outline-header-title': 'Seitenstruktur',
  'outline-header-collapseall': 'Alle einklappen',
  'outline-item-duplicate': 'Duplizieren',
  'outline-item-delete': 'Löschen',
  'drawer-category-collapse': '{title} einklappen',
  'drawer-category-expand': '{title} ausklappen',
  'drawer-category-other': 'Weitere',
  'field-readonly': 'Nur lesen',
  'field-arrayitem-summary': 'Eintrag {index}',
  'field-arrayitem-duplicate': 'Duplizieren',
  'field-arrayitem-delete': 'Löschen',
};

const SECTION_LABEL = 'mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-black/35';

export default function SiteOsBlockEditor(props: SiteOsBlockEditorProps): ReactElement {
  const {
    storedBlueprint, localBlueprint, template, pagePath, pageData,
    onPageDataChange, canvasWidth, asideLeft, asideRight, canvasHeader, revision,
  } = props;

  const storedPage = storedBlueprint.pages.find((p) => p.path === pagePath) ?? storedBlueprint.pages[0];
  const localPage = localBlueprint.pages.find((p) => p.path === storedPage.path) ?? storedPage;

  // Die Konfiguration hängt am gespeicherten Stand (Brief für Vorbelegungen),
  // nicht am lokalen — sonst würde jeder Tastendruck sie neu bauen.
  const config = useMemo(() => createSiteOsPuckConfig(storedBlueprint), [storedBlueprint]);

  // Puck liest `data` nur beim Aufsetzen. Der Editor wird per `key` neu
  // aufgesetzt, wenn Seite oder Revision wechseln — dann zählt der hier
  // gemerkte Stand der Seite, falls sie schon bearbeitet wurde.
  const initialData = useMemo<PuckPageData>(
    () => pageData ?? pageToPuckData(storedPage),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storedPage.path, revision],
  );

  const themed = useMemo(() => applySiteDesignTemplate(localBlueprint, template), [localBlueprint, template]);
  const canvasCss = useMemo(() => renderCanvasCss(themed.theme), [themed.theme]);

  const metadata = useMemo<CanvasMetadata>(() => {
    const headings: Record<string, 'h1' | 'h2'> = {};
    for (const block of renderPageBlocks(themed, localPage)) {
      if (block.heading) headings[block.id] = block.heading;
    }
    return { blueprint: themed, headings };
  }, [themed, localPage]);

  const pathRef = useRef(storedPage.path);
  pathRef.current = storedPage.path;

  return (
    <CanvasCssContext.Provider value={canvasCss}>
      <Puck
        key={`${revision}:${storedPage.path}`}
        config={config}
        data={initialData as Data}
        metadata={metadata}
        overrides={OVERRIDES}
        dictionary={DICTIONARY}
        iframe={{ enabled: true, waitForStyles: true }}
        onChange={(data) => onPageDataChange(pathRef.current, data as PuckPageData)}
      >
        <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[260px_minmax(0,1fr)_320px]">
          <aside className="hidden border-r border-black/[.07] bg-white p-4 lg:block">
            {/* Puck bringt die Überschriften „Seitenstruktur" und „Bausteine" selbst mit. */}
            <div className="text-xs [&_*]:text-xs"><Puck.Outline /></div>
            <div className="mt-6 border-t border-black/[.07] pt-5">
              <p className="mb-3 text-[11px] leading-5 text-black/45">In die Seite ziehen. Formulare und Karten bringen Rechtsgrundlage und Einwilligung mit.</p>
              <div className="text-xs [&_*]:text-xs"><Puck.Components /></div>
            </div>
            {asideLeft}
          </aside>

          <section className="min-w-0 p-3 sm:p-5">
            {canvasHeader}
            <div className="flex min-h-[calc(100vh-10rem)] items-start justify-center overflow-auto rounded-2xl border border-black/[.08] bg-[#dfe4ea] p-3 sm:p-6">
              <div style={{ width: canvasWidth }} className="h-[760px] overflow-hidden rounded-xl bg-white shadow-2xl [&>div]:h-full">
                <Puck.Preview />
              </div>
            </div>
          </section>

          <aside className="border-t border-black/[.07] bg-white p-4 lg:border-l lg:border-t-0 sm:p-5">
            <div className={SECTION_LABEL}>Ausgewählter Baustein</div>
            <PageEditNote pagePath={storedPage.path} pageData={pageData} />
            <div className="text-xs [&_input]:text-xs [&_textarea]:text-xs"><Puck.Fields /></div>
            {asideRight}
          </aside>
        </div>
      </Puck>
    </CanvasCssContext.Provider>
  );
}

/**
 * Sagt, was eine Bearbeitung serverseitig auslösen wird — bevor gespeichert
 * wird. Die Anfrage entsteht aus denselben Daten wie die Leinwand.
 */
function PageEditNote({ pagePath, pageData }: { pagePath: string; pageData?: PuckPageData }): ReactElement | null {
  if (!pageData) return null;
  const edit = toPageEdit(pagePath, pageData);
  const added = edit.blocks.filter((b) => !b.id).length;
  if (added === 0) return null;
  return (
    <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] leading-5 text-amber-800">
      {added === 1 ? 'Ein neuer Baustein' : `${added} neue Bausteine`} — Rechtsgrundlage, Einwilligung und KI-Kennzeichnung setzt der Server beim Speichern, nicht der Browser.
    </p>
  );
}
