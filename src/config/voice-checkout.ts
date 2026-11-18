/**
 * Anzeige-Schalter für den Kauf des eigenständigen Voice-Agent-Abos.
 *
 * Nur das Frontend: `VITE_VOICE_CHECKOUT_ENABLED=true` im Build zeigt die
 * Kauf-Knöpfe. Default = aus. Ob wirklich verkauft wird, entscheidet der
 * Server (`VOICE_CHECKOUT_ENABLED` in checkout-voice-agent) zusammen mit dem
 * freigegebenen Angebot (`isStandaloneVoiceOfferReleased`) und dem Deploy
 * der Function (`isEdgeFunctionInProduction`).
 */
import { isStandaloneVoiceOfferReleased, type StandaloneVoiceOffer } from '@/shared/pricing';
import { isEdgeFunctionInProduction } from './production-edge-functions';

export const VOICE_CHECKOUT_FUNCTION = 'checkout-voice-agent';

export function voiceCheckoutFlagEnabled(raw: unknown = import.meta.env?.VITE_VOICE_CHECKOUT_ENABLED): boolean {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

/** Darf für dieses Angebot ein Kauf-Knopf erscheinen? */
export function canOfferVoiceCheckout(
  offer: StandaloneVoiceOffer,
  flag: boolean = voiceCheckoutFlagEnabled(),
  deployed: boolean = isEdgeFunctionInProduction(VOICE_CHECKOUT_FUNCTION),
): boolean {
  return flag && deployed && isStandaloneVoiceOfferReleased(offer);
}
