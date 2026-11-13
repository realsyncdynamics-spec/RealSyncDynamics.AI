/**
 * Anzeige-Modell für Social-Konten im Command Center.
 *
 * Die Fläche ist fail-closed: ohne geladene Entitlements, ohne
 * `dashboard.access` oder bei ausgeschaltetem Flag `social_channel_connect`
 * wird nichts gerendert und nichts abgefragt. `connector_social` bleibt
 * proposed; diese Funktion lockert `selectWidgetsForEntitlements` nicht.
 *
 * Verbinden und Rotieren bleiben Platzhalter, bis der serverseitige
 * LinkedIn-OAuth steht. Der Browser schickt keine Credentials.
 *
 * Ein späterer Flow darf nur die dokumentierten LinkedIn-Endpunkte nutzen
 * (Authorization Code, OpenID Connect) und nur die minimalen Scopes
 * `openid` und `profile` anfragen:
 * https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 * https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 * Authorization: https://www.linkedin.com/oauth/v2/authorization
 * Token: https://www.linkedin.com/oauth/v2/accessToken
 * Posting-Scopes gehören nicht in den Verbindungs-Platzhalter.
 */

import { isWidgetFeatureEnabled } from './flags';
import { entitlementIsOn, entitlementsToValueMap } from './selectWidgets';

export type SocialChannelAvailability = 'placeholder' | 'in_development';

export interface SocialChannelOffer {
  id: 'linkedin' | 'x' | 'instagram' | 'tiktok' | 'facebook';
  label: string;
  availability: SocialChannelAvailability;
}

/** LinkedIn zuerst, danach die Kanäle ohne Verbinden-Aktion. */
export const SOCIAL_CHANNEL_OFFERS: readonly SocialChannelOffer[] = [
  { id: 'linkedin', label: 'LinkedIn', availability: 'placeholder' },
  { id: 'x', label: 'X', availability: 'in_development' },
  { id: 'instagram', label: 'Instagram', availability: 'in_development' },
  { id: 'tiktok', label: 'TikTok', availability: 'in_development' },
  { id: 'facebook', label: 'Facebook', availability: 'in_development' },
];

const STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'ausstehend',
  connected: 'verbunden',
  expired: 'abgelaufen',
  error: 'Fehler',
  disabled: 'deaktiviert',
  revoked: 'getrennt',
};

/**
 * Eigenes Gate, nicht `showWidget` und nicht `selectWidgetsForEntitlements`.
 * `entitlements == null` oder `tenantLoading` ist noch nicht entschieden:
 * nichts anzeigen. Fehlendes oder ausgeschaltetes `dashboard.access` ebenso.
 */
export function socialChannelConnectAllowed(
  entitlements: { byKey: Readonly<Record<string, { value: number }>> } | null | undefined,
  tenantLoading: boolean,
): boolean {
  if (tenantLoading || entitlements == null) return false;
  if (!isWidgetFeatureEnabled('social_channel_connect')) return false;
  return entitlementIsOn(entitlementsToValueMap(entitlements), 'dashboard.access');
}

/** Spiegelt social-channel-connect (owner/admin). Maßgeblich bleibt der Server. */
export function canManageSocialChannels(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function socialStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'unbekannt';
}

/** Nur das Datum. Kein Rohwert, der kein Datum ist. */
export function socialExpiryLabel(value: string | null): string {
  if (!value) return 'kein Ablaufdatum';
  const day = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return day ? day[1] : 'kein Ablaufdatum';
}

export function socialDisplayName(name: string | null): string {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : 'Ohne Anzeigename';
}
