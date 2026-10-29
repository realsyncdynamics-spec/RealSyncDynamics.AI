import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

/**
 * Ehrlicher Hinweis für Governance-Flächen, die noch kein Backend haben (#1381).
 * Angezeigte Inhalte sind Beispieldaten; Änderungen werden nicht gespeichert.
 */
export function PreviewDataNotice({
  what = 'Diese Ansicht',
  realLink,
}: {
  what?: string;
  realLink?: { to: string; label: string };
}) {
  return (
    <div
      role="note"
      data-testid="preview-data-notice"
      className="mx-4 mt-4 flex items-start gap-3 border border-amber-700/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <strong>Vorschau mit Beispieldaten.</strong> {what} ist noch nicht an Ihre Mandantendaten
        angebunden. Angezeigte Werte sind Beispiele, Änderungen werden nicht gespeichert.
        {realLink && (
          <>
            {' '}
            <Link to={realLink.to} className="underline hover:text-amber-100">
              {realLink.label}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

/** Deaktivierter Button-Ersatz für Aktionen ohne Backend. */
export const UNAVAILABLE_TITLE = 'Noch nicht verfügbar – wird nicht gespeichert';
