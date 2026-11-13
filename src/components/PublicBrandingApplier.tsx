import { useEffect } from "react";
import { applyPublicBranding, loadPublicBranding } from "../lib/branding/loadPublicBranding";

/**
 * Hängt öffentliches Branding an, wenn die App auf einer Kundendomain läuft.
 * Auf realsyncdynamicsai.de, Pages-Previews und localhost passiert nichts.
 * Kein RPC, kein tenant_id.
 */
export function PublicBrandingApplier() {
  useEffect(() => {
    let cancelled = false;
    const host = window.location.hostname;
    void loadPublicBranding(host)
      .then((branding) => {
        if (cancelled || !branding) return;
        applyPublicBranding(branding);
      })
      .catch(() => {
        // öffentlicher Lookup darf die App nicht blockieren
      });
    return () => { cancelled = true; };
  }, []);
  return null;
}
