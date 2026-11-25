// .claude/hooks/lib/voice-hosts.mjs – nicht freigegebene externe Voice-/Telefonie-Dienste (Phase 3d, 25.11.2026)
// Jeder Aufruf dieser Dienste kostet Geld oder erreicht echte Telefonnummern. Agenten dürfen sie
// nicht direkt ansprechen (AGENTS.md „Freigaben“, vio.md „Kosten und externe Dienste“).
// Freigabe eines Dienstes = Eintrag hier entfernen, nur per PR mit Einzelfreigabe von Dominik.
// Es gibt bewusst keinen Umgehungsschalter per Umgebungsvariable.

// Domains inkl. aller Subdomains (api.elevenlabs.io, api.eu.residency.elevenlabs.io, voice.twilio.com …)
export const BLOCKED_VOICE_DOMAINS = [
  'elevenlabs.io', 'elevenlabs.com', 'elevenlabs.ai',
  'twilio.com', 'twil.io',
  'vapi.ai', 'retellai.com', 'bland.ai', 'synthflow.ai',
  'vonage.com', 'nexmo.com', 'telnyx.com', 'plivo.com',
  'sipgate.com', 'sipgate.de', 'sipgate.io',
  'deepgram.com', 'cartesia.ai', 'play.ht', 'playht.com',
];

// Kommandozeilenwerkzeuge der Anbieter (auch über npx/pnpm dlx)
export const BLOCKED_VOICE_CLIS = new Set(['twilio', 'elevenlabs', 'vapi', 'telnyx', 'vonage', 'plivo', 'deepgram', 'retell']);

// Namensbestandteile von MCP-Servern dieser Anbieter (Tool-Name mcp__<server>__<tool>)
const VOICE_MCP_SERVER = /elevenlabs|eleven_labs|twilio|vapi|retell|bland|vonage|nexmo|telnyx|plivo|sipgate|deepgram|cartesia|playht/i;
// Reine Doku-Suche bleibt erlaubt (kein Kontakt zur Anbieter-API, keine Kosten).
const ALLOWED_VOICE_MCP_SERVERS = new Set(['plugin_twilio-developer-kit_twilio-docs']);

/** Liefert den Servernamen, wenn ein MCP-Tool zu einem gesperrten Voice-Anbieter gehört, sonst null. */
export function blockedVoiceMcpServer(toolName) {
  if (typeof toolName !== 'string' || !toolName.startsWith('mcp__')) return null;
  const server = toolName.slice(5).split('__')[0];
  if (ALLOWED_VOICE_MCP_SERVERS.has(server)) return null;
  return VOICE_MCP_SERVER.test(server) ? server : null;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HOST_RE = new RegExp(`(^|[^a-z0-9-])((?:[a-z0-9-]+\\.)*(?:${BLOCKED_VOICE_DOMAINS.map(escape).join('|')}))(?![a-z0-9-])(?!\\.[a-z])`, 'i');

/** Liefert den gesperrten Host, wenn `text` irgendwo einen nennt, sonst null. */
export function findBlockedHost(text) {
  if (typeof text !== 'string' || !text) return null;
  const m = HOST_RE.exec(text);
  return m ? m[2].toLowerCase() : null;
}

// Öffentliche Lese-Seiten (Preise, Doku, Status) der Anbieter: für ATLAS-Recherche erlaubt.
// Nur für URL-Abrufe ohne Zugangsdaten (WebFetch, URL-Felder von MCP-Crawlern), nie für Bash.
// Alles andere unter den Domains (api., voice., *.twil.io, Residency-Hosts …) bleibt gesperrt.
const PUBLIC_LABELS = new Set(['www', 'docs', 'help', 'support', 'status', 'blog', 'community']);

/**
 * Prüft eine URL (oder einen nackten Host) für Lese-Abrufe. Rückgabe: gesperrter Host oder null.
 * `publicPagesAllowed` = Bare-Domain und PUBLIC_LABELS erlaubt (Standard für WebFetch/MCP-URL-Felder).
 * Unparsbare Werte werden textlich geprüft (fail-closed).
 */
export function blockedUrlHost(value, { publicPagesAllowed = true } = {}) {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value.includes('://') ? value : `https://${value}`);
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    const hit = BLOCKED_VOICE_DOMAINS.find((d) => host === d || host.endsWith(`.${d}`));
    if (!hit) return null;
    if (u.username || u.password) return host;                                  // Zugangsdaten in der URL
    const sub = host === hit ? '' : host.slice(0, -hit.length - 1);
    const isPublic = sub === '' || PUBLIC_LABELS.has(sub);                       // genau eine öffentliche Ebene
    if (publicPagesAllowed && isPublic && hit !== 'twil.io') return null;      // *.twil.io = ausführbare Functions
    return host;
  } catch {
    return findBlockedHost(value);
  }
}
