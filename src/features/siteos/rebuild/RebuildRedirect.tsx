// Frühere Einstiege in den URL-Neubau (`/unified-entry/transformation`,
// `/app/siteos/builder`) führen in den Rebuild-Workflow.
//
// Warum umleiten statt die alte Seite zu behalten: Der frühere Weg baute aus
// einer bestehenden Website einen Blueprint mit der Herkunft `ai-builder` —
// der Publish Gate hielt eine Transformation damit für einen Neubau ohne
// Vorgänger und prüfte kein Backend. Der Rebuild legt die Herkunft `import`
// an und vergleicht serverseitig gegen den Snapshot der Ausgangsseite.
//
// Übernommen werden nur Absichten (Adresse, Anweisung), keine Autorität.

import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export function RebuildRedirect(): ReactElement {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = new URLSearchParams();
  const url = params.get('url') ?? params.get('domain');
  if (url) next.set('url', url);
  const instruction = params.get('instruction');
  if (instruction) next.set('instruction', instruction);
  const query = next.toString();
  return <Navigate to={`/app/siteos/rebuild${query ? `?${query}` : ''}`} replace />;
}
