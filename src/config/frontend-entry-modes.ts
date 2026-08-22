/**
 * Die Wege, auf denen ein Frontend bei RealSync entstehen kann — und was
 * davon die Runtime **heute** tatsächlich ausführt.
 *
 * Der Zweck dieser Datei ist eine Regel, keine Textsammlung:
 * **Es darf keine Option angeboten werden, die der Runtime-Stand nicht
 * ausführen kann.** Ein Einstiegspunkt, der ein Foto entgegennimmt und
 * anschliessend nichts damit tut, ist schlimmer als ein Einstiegspunkt, den
 * es noch nicht gibt — er verspricht eine Automation, die es nicht gibt, und
 * genau davor warnt `CLAUDE.md` §14 („kein Element vortäuschen, das nichts
 * tut").
 *
 * `available` ist deshalb keine Meinung, sondern eine Behauptung über den
 * Code. Wer sie umstellt, muss den Pfad vorher gebaut haben — der Test
 * `test/config/frontend-entry-modes.test.ts` erzwingt, dass jeder nicht
 * verfügbare Modus einen Grund und eine benannte Vorbedingung trägt.
 *
 * Belege für den heutigen Stand (gemessen 2026-08-22, siehe
 * `docs/product/reality-matrix.md`):
 *  - `supabase/functions/siteos/handlers/builder.ts` nimmt `tenant_id`,
 *    `prompt`, `locale`, `enrichment`, `model`, `project_id` entgegen —
 *    **keine Bilder, kein Logo, keinen Screenshot**.
 *  - `siteos/handlers/` enthält `discover`, `builder`, `runtime-scan`,
 *    `agents` — **keinen Publish-Handler**.
 *  - Es gibt keine Vision-Analyse und keinen Storage-Bucket für
 *    Design-Assets im gesamten Repository.
 */

export type FrontendEntryModeId =
  | 'modernize_existing'
  | 'from_description'
  | 'from_own_media'
  | 'from_reference'
  | 'frontend_for_existing_backend';

export interface FrontendEntryMode {
  id: FrontendEntryModeId;
  name: string;
  /** Ein Satz: was der Nutzer bekommt. */
  description: string;
  /** Die tatsächliche Verarbeitungskette, in der Sprache des Produkts. */
  pipeline: string;
  /** Führt die Runtime diesen Weg heute aus? */
  available: boolean;
  /**
   * Warum nicht — in einem Satz, der einem Kunden genügt.
   * `null` genau dann, wenn `available` true ist.
   */
  unavailableReason: string | null;
  /** Was gebaut sein muss, damit `available` auf true darf. `null` wenn verfügbar. */
  requires: string | null;
}

export const FRONTEND_ENTRY_MODES: FrontendEntryMode[] = [
  {
    id: 'modernize_existing',
    name: 'Bestehende Website modernisieren',
    description:
      'Ihre bestehende Website wird analysiert; daraus entsteht ein individuelles Frontend mit Ihren vorhandenen Inhalten.',
    pipeline: 'URL analysieren → Struktur und Inhalte erfassen → Design ableiten → Frontend erzeugen',
    available: true,
    unavailableReason: null,
    requires: null,
  },
  {
    id: 'from_description',
    name: 'Aus Ihrer Beschreibung erstellen',
    description:
      'Sie beschreiben Unternehmen, Leistungen und gewünschte Wirkung in eigenen Worten; daraus entsteht ein vollständiges Frontend.',
    pipeline: 'Beschreibung → Seitenstruktur → Design → Frontend',
    available: true,
    unavailableReason: null,
    requires: null,
  },
  {
    id: 'from_own_media',
    name: 'Mit eigenen Inhalten und Medien gestalten',
    description:
      'Logo, Bilder und Videos einbringen und individuell im Frontend platzieren — Farben und Bildsprache werden daraus abgeleitet.',
    pipeline: 'Logo + Bilder + Videos → Bildanalyse → Design-System → Frontend',
    available: false,
    unavailableReason:
      'Es gibt noch keinen Ablageort für Design-Medien und keine Bildanalyse — hochgeladene Bilder könnten heute nicht in das Design einfliessen.',
    requires: 'Asset-Ablage mit Mandantentrennung und Bildanalyse (Design Intelligence, Teil A)',
  },
  {
    id: 'from_reference',
    name: 'Design anhand einer Referenz entwickeln',
    description:
      'Ein Screenshot oder Bild dient als visuelle Orientierung; die Gestaltungsrichtung wird daraus abgeleitet und neu umgesetzt.',
    pipeline: 'Referenzbild → visuelle Analyse → Design-System → Frontend',
    available: false,
    unavailableReason:
      'Die visuelle Analyse von Referenzbildern ist noch nicht gebaut.',
    requires: 'Vision-Analyse, die in die vorhandene Token-Ebene schreibt (Design Intelligence, Teil A)',
  },
  {
    id: 'frontend_for_existing_backend',
    name: 'Frontend für Ihr bestehendes Backend',
    description:
      'Ihre vorhandene Logik, API und Daten bleiben unverändert; erneuert wird ausschliesslich die Benutzeroberfläche.',
    pipeline: 'Bestehende API behalten → neue Präsentationsschicht erzeugen → anbinden',
    available: false,
    unavailableReason:
      'Das erzeugte Frontend lässt sich noch nicht an eine fremde API binden und noch nicht veröffentlichen.',
    requires: 'Anbindung an externe APIs sowie Publish Gate und Publish-Pfad',
  },
];

/** Was heute angeboten werden darf. */
export const AVAILABLE_FRONTEND_ENTRY_MODES: FrontendEntryMode[] =
  FRONTEND_ENTRY_MODES.filter((m) => m.available);

/** Was benannt, aber nicht angeboten wird. */
export const PLANNED_FRONTEND_ENTRY_MODES: FrontendEntryMode[] =
  FRONTEND_ENTRY_MODES.filter((m) => !m.available);

export function frontendEntryModeById(id: FrontendEntryModeId): FrontendEntryMode | undefined {
  return FRONTEND_ENTRY_MODES.find((m) => m.id === id);
}

/**
 * Positionierung des Frontend-Wegs — bewusst hier und nicht in einer
 * Komponente, damit alle Oberflächen dieselbe Aussage treffen.
 */
export const FRONTEND_INDIVIDUALITY_NOTE =
  'Keine starren Templates: Ihr Frontend wird individuell aus Ihren Anforderungen, Inhalten und Designvorgaben zusammengestellt.';

/**
 * Der Stand, an dem der Frontend-Weg heute endet.
 *
 * Steht hier, damit keine Oberfläche eine Veröffentlichung zusagt, die die
 * Runtime nicht leisten kann: SiteOS hat Discovery, Builder, Runtime-Scan
 * und Agenten — aber keinen Publish-Handler.
 */
export const FRONTEND_DELIVERY_LIMIT_NOTE =
  'Der Entwurf endet derzeit bei der Vorschau; die Veröffentlichung erfolgt im Anschluss durch das Team.';
