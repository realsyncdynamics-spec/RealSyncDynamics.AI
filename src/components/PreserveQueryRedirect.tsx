import { Navigate, useLocation } from 'react-router-dom';

/**
 * Redirect, der die Query-Parameter mitnimmt.
 *
 * `<Navigate to="/welcome" replace />` verwirft `location.search` — die
 * Alias-Routen (`/login`, `/signin`, `/signup`, `/register`, `/dashboard`,
 * `/app`) haben damit jeden Kontext weggeworfen, der über die URL kam.
 * Konkret ging `?intent=pilot&audit_id=…&domain=…` auf dem Weg von der
 * Audit-CTA zur Anmeldung verloren, und `?welcome=pilot&domain=…` auf dem Weg
 * zum Dashboard.
 *
 * Der Hash wird bewusst ebenfalls durchgereicht: Supabase liefert
 * OAuth-/Magic-Link-Fehler als `#error=…` zurück, und `Welcome.tsx` wertet
 * genau das aus.
 */
export function PreserveQueryRedirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={{ pathname: to, search, hash }} replace />;
}
