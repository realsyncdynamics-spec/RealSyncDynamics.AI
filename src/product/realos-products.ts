/**
 * RealOS — Produkte der Startfläche (`/app/start`) und Erklärung „hinter der Karte“.
 *
 * Eine Quelle für Kacheln, Erklärungen und das Intent-Routing des Eingabefelds.
 * Der Status wird NICHT hier gepflegt, sondern aus `implementation-status.ts`
 * gelesen (`statusId`). Preise stehen ausschließlich in `shared/pricing.ts`
 * und werden hier nicht wiederholt.
 *
 * Reihenfolge nach K4 (AGENTS.md): KI-Empfang zuerst, Governance als
 * Infrastruktur zuletzt.
 *
 * Intent-Routing: deterministisch über Schlüsselwörter — kein Modell-Call.
 * Freie Fragen gehen an den bestehenden Assistenten der Shell
 * (`ASSISTANT_PROMPT_EVENT`); abgeschickt wird erst dort, nach dem Datenhinweis.
 */
import {
  getImplementation,
  type ImplementationStatus,
} from './implementation-status';

export type RealOsProductId = 'reception' | 'builder' | 'optimizer' | 'governance';

export interface RealOsProduct {
  id: RealOsProductId;
  /** Bereich wie auf den Landing-Karten (Monospace-Metadatum). */
  kicker: 'AUTOMATE' | 'BUILD' | 'GOVERN';
  name: string;
  /** Ein Satz ohne Fachjargon — was der Kunde davon hat. */
  oneLiner: string;
  /** Für wen (eine Zeile). */
  audience: string;
  /** Genau drei Schritte, wie es abläuft. */
  steps: readonly [string, string, string];
  /** Was der Kunde am Ende konkret hat — nur, was der Code heute hergibt. */
  outcome: string;
  /** Eintrag in `IMPLEMENTATION_ITEMS`, aus dem der Status gelesen wird. */
  statusId: string;
  /** Optionaler Zusatzstatus (z. B. Telefonie). */
  subStatus?: { label: string; statusId: string };
  /** Ziel im Produkt. */
  route: string;
  /** Einstiegs-CTA (nie Pilot/Demo/Call/Sales/Beratung/Termin). */
  cta: string;
  /** Schlüsselwort-Stämme für das Intent-Routing (klein, ohne Umlaut-Ersatz). */
  keywords: readonly string[];
}

export const REALOS_PRODUCTS: readonly RealOsProduct[] = [
  {
    id: 'reception',
    kicker: 'AUTOMATE',
    name: 'KI-Bots & Voice Agenten',
    oneLiner: 'Ein digitaler Empfang nimmt Anfragen an und gibt sie an dich weiter.',
    audience: 'Betriebe mit Kundenkontakt, zuerst Handwerk.',
    steps: [
      'Bot anlegen und deinen Betrieb kurz beschreiben.',
      'Kanal wählen: Website-Chat, WhatsApp oder Telegram.',
      'Gespräche landen im Posteingang, du übernimmst, wo nötig.',
    ],
    outcome: 'Eingehende Gespräche gesammelt im Bot-Posteingang.',
    statusId: 'channel-bots',
    subStatus: { label: 'Telefonie', statusId: 'voice-telephony' },
    route: '/app/bots',
    cta: 'Bot einrichten',
    keywords: [
      'bot', 'chatbot', 'chat', 'anfrage', 'empfang', 'rezeption', 'receptionist',
      'whatsapp', 'telegram', 'telefon', 'anruf', 'voice', 'kunde', 'termin',
      'posteingang', 'nachricht',
    ],
  },
  {
    id: 'builder',
    kicker: 'BUILD',
    name: 'App Builder',
    oneLiner: 'Beschreib deine Website, das Studio baut einen Entwurf, den du prüfst und freigibst.',
    audience: 'Alle, die eine neue Website oder kleine Web-App brauchen.',
    steps: [
      'Idee in eigenen Worten beschreiben.',
      'Entwurf im Studio anpassen.',
      'Vorschau prüfen, veröffentlicht wird erst nach deiner Freigabe.',
    ],
    outcome: 'Ein Website-Entwurf mit Vorschau. Eigene Domain folgt noch.',
    statusId: 'web-builder',
    route: '/build',
    cta: 'Idee beschreiben',
    keywords: [
      'website', 'webseite', 'homepage', 'landingpage', 'seite', 'app', 'bauen',
      'erstellen', 'builder', 'baukasten', 'shop', 'onlineshop',
    ],
  },
  {
    id: 'optimizer',
    kicker: 'BUILD',
    name: 'Claude Code Optimizer',
    oneLiner: 'Wir prüfen deine Website und zeigen dir konkret, was du reparieren solltest.',
    audience: 'Website-Betreiber und Entwickler.',
    steps: [
      'Adresse deiner Website eingeben.',
      'Der Scan prüft auf DSGVO- und EU-AI-Act-Risiken.',
      'Du erhältst einen Bericht mit Fix-Hinweisen.',
    ],
    outcome: 'Befundbericht mit Fix-Hinweisen. Code wird nicht automatisch geändert.',
    statusId: 'cloud-code-optimizer',
    route: '/claude-code-optimizer',
    cta: 'Website eingeben',
    keywords: [
      'code', 'optimier', 'optimizer', 'fehler', 'reparier', 'fix', 'entwickler',
      'scan', 'check', 'cookie', 'tracking', 'impressum',
    ],
  },
  {
    id: 'governance',
    kicker: 'GOVERN',
    name: 'Governance OS',
    oneLiner: 'Regeln, Freigaben und Nachweise an einem Ort.',
    audience: 'Teams, die Regeln und Nachweise selbst steuern möchten.',
    steps: [
      'Websites und KI-Systeme erfassen.',
      'Risiken bewerten und Freigaben festlegen.',
      'Nachweise sammeln und als Prüfpfad abrufen.',
    ],
    outcome: 'Ein Prüfpfad mit Nachweisen für DSGVO und EU AI Act.',
    statusId: 'app-shell',
    route: '/app/dashboard',
    cta: 'Übersicht öffnen',
    keywords: [
      'governance', 'dsgvo', 'datenschutz', 'compliance', 'nachweis', 'evidence',
      'freigabe', 'risiko', 'ai act', 'aiact', 'audit', 'regel', 'richtlinie',
      'dsfa', 'prüfpfad',
    ],
  },
];

/** Schnellstarts unter dem Eingabefeld — nur erreichbare Ziele. */
export interface RealOsQuickAction {
  id: string;
  label: string;
  route: string;
}

export const REALOS_QUICK_ACTIONS: readonly RealOsQuickAction[] = [
  { id: 'audit', label: 'Website kostenlos prüfen', route: '/audit' },
  { id: 'inbox', label: 'Bot-Posteingang öffnen', route: '/app/bots/inbox' },
  { id: 'build', label: 'Neue Website beschreiben', route: '/build' },
  { id: 'evidence', label: 'Nachweise ansehen', route: '/app/evidence' },
];

/** Kundenlesbare Statuslabels (wie auf den Landing-Karten). */
export const REALOS_STATUS_LABEL: Record<ImplementationStatus, string> = {
  live: 'Live',
  preview: 'Preview',
  'coming-soon': 'In Vorbereitung',
};

/**
 * Status aus der SSoT. Fehlt der Eintrag, gilt fail-closed „coming-soon“ —
 * ein falsches „Live“ wäre ein Claim ohne Beleg.
 */
export function realOsStatus(statusId: string): ImplementationStatus {
  return getImplementation(statusId)?.status ?? 'coming-soon';
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/)
    .filter(Boolean);
}

/**
 * Bestes Produkt zur Eingabe oder `null`. Ein Schlüsselwort trifft, wenn ein
 * Wort der Eingabe mit dem Stamm beginnt („anfragen“ → „anfrage“).
 * Mehrwortige Stämme („ai act“) werden als Phrase gesucht.
 * Gleichstand → Reihenfolge in `REALOS_PRODUCTS`.
 */
export function matchProduct(text: string): RealOsProduct | null {
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  let best: RealOsProduct | null = null;
  let bestScore = 0;
  for (const product of REALOS_PRODUCTS) {
    let score = 0;
    for (const keyword of product.keywords) {
      const hit = keyword.includes(' ')
        ? lower.includes(keyword)
        : tokens.some((token) => token.startsWith(keyword));
      if (hit) score += 1;
    }
    if (score > bestScore) {
      best = product;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Erkennt eine Web-Adresse („example.de“, „https://…“) und liefert sie mit
 * Schema zurück; sonst `null`. Leerzeichen ⇒ keine Adresse.
 */
export function asWebAddress(text: string): string | null {
  const value = text.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      return new URL(value).toString();
    } catch {
      return null;
    }
  }
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(value)) return null;
  return `https://${value}`;
}
