/**
 * `/unified-entry/register` — Weiterleitung auf die eine Anmeldung.
 *
 * Freigabe des Eigentümers vom 2026-09-01 (CLAUDE.md §10): Ein Anmeldeweg für
 * alle Trichter. Diese Seite führte bis dahin ein eigenes Formular
 * (E-Mail/Passwort plus OAuth) und schickte danach direkt nach
 * `/unified-entry/onboarding` — vorbei an `/welcome`, also ohne Audit-Claim,
 * Setup-Assistent und `onboarded_at`-Prüfung. Zwei Anmeldungen, zwei
 * Zustände, zwei Fehlerbilder (docs/product/addon-booking.md §6.4).
 *
 * Jetzt: `/welcome?next=/unified-entry/onboarding` — die Rückkehr in den
 * Unified-Entry-Pfad bleibt erhalten, samt Abfrageparametern (`plan`,
 * `track`), die `PostRegisterOnboardingPage` liest. Das Formular ist entfallen,
 * nicht versteckt (CLAUDE.md §14: Abgelöstes benennen).
 */
import { Navigate, useLocation } from 'react-router-dom';

export function registerRedirectTarget(search: string): string {
  const next = `/unified-entry/onboarding${search && search !== '?' ? search : ''}`;
  return `/welcome?next=${encodeURIComponent(next)}`;
}

export function RegisterPage() {
  const { search } = useLocation();
  return <Navigate to={registerRedirectTarget(search)} replace />;
}
