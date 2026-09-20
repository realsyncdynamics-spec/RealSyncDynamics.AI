/**
 * Gestaltungswerte der oeffentlichen Seiten — Design-Lock v2 (2026-09-13):
 * „Hollywood Enterprise VIP" — True Black · Cyan `#22c3e6` (Aktion) ·
 * City-Light Gold `#f2c98a` (VIP-Stufe). Freigabe: Dominik.
 *
 * Cyan traegt die Handlung (CTA, Linien, Netz), Gold die Wertigkeit
 * (Enterprise-Zugang). Die Trennung ist scharf: Standard-CTA, Links,
 * Navigation, Governance Runtime und gewoehnliche Hover-Zustaende sind
 * Cyan; Gold bleibt der Premium-Stufe vorbehalten.
 *
 * `LANDING_ACCENT_SOFT` und `LANDING_ACCENT_LITE` standen bis zur
 * Konsolidierung noch auf v1-Gold. Ihre Konsumenten sind das Europa-Netz,
 * der Runtime-Verlauf und der Evidence-CTA — allesamt Stellen, an denen
 * Gold unter v2 falsch ist. Sie tragen jetzt die dunkle und die helle
 * Variante derselben Cyan-Familie; beide Werte kommen aus dem Entwurf
 * (Netz-Verlauf, Fokus-Glow) und sind nicht neu erfunden.
 *
 * Achtung: `governance-os/osChrome.ts` re-exportiert dreizehn dieser
 * Konstanten als `OS_*` fuer `/app` und `/build`. Solange diese Kopplung
 * besteht, zieht jede Aenderung hier das App-Chrome mit.
 */

export const LANDING_BG = '#000000';
export const LANDING_PANEL = 'rgba(4, 8, 14, 0.72)';
export const LANDING_SANS = "'Inter', system-ui, sans-serif";
export const LANDING_SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
export const LANDING_MONO = "'JetBrains Mono', 'DM Mono', ui-monospace, monospace";
export const LANDING_TEXT = '#f4f6f8';
export const LANDING_MUTED = '#8a9bb0';
/** Handlungsakzent — Cyan. CTA, Linien, Netz. */
export const LANDING_ACCENT = '#22c3e6';
/** VIP-Stufe — City-Light Gold. Enterprise-Sektion, Agency-Tarif, Hover-Glow. */
export const LANDING_ACCENT_VIP = '#f2c98a';
/** Dunkle Cyan-Variante — Netzknoten, Verlaufsanfang. */
export const LANDING_ACCENT_SOFT = '#0e8aa6';
/** Helle Cyan-Variante — Verlaufsmitte, Glanzkanten. */
export const LANDING_ACCENT_LITE = '#7fe3f5';
export const LANDING_BUTTON = '#22c3e6';
export const LANDING_BUTTON_ALT = '#4fd7f0';
export const LANDING_BUTTON_TEXT = '#041016';
export const LANDING_CTA_GLOW =
  '0 0 0 1px rgba(127, 227, 245, 0.35), 0 0 34px rgba(34, 195, 230, 0.35)';
export const LANDING_GREEN = '#35d0a8';
export const LANDING_LINE = 'rgba(34, 195, 230, 0.16)';
export const LANDING_TRUST_MARKS = [
  'EU AI ACT READY',
  'ISO 42001 ALIGNED',
  'DSGVO FIRST',
  'AUDIT TRAIL NATIVE',
] as const;

export const LANDING_H1 = 'clamp(2.8rem, 1rem + 5vw, 5.8rem)';
export const LANDING_H2 = 'clamp(1.8125rem, 1.15rem + 2.3vw, 2.75rem)';
export const LANDING_H2_LG = 'clamp(1.9rem, 1.2rem + 2.5vw, 2.875rem)';
export const LANDING_BODY = 'clamp(1rem, 0.92rem + 0.35vw, 1.125rem)';
export const LANDING_EYEBROW = '0.75rem';
export const LANDING_META = '0.625rem';
