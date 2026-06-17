// OfficeWorkspace — mappt die Route-Section (/app/office/:section) auf die
// passende Office-View und rendert sie innerhalb der OfficeShell (Sub-Nav).
import { Navigate, useParams } from 'react-router-dom';
import { OfficeShell } from './OfficeShell';
import { findOfficeArea, type OfficeAreaId, OFFICE_BASE_ROUTE } from './officeAreas';
import { DokumenteView } from './views/DokumenteView';
import { TabellenView } from './views/TabellenView';
import { PraesentationenView } from './views/PraesentationenView';
import { VorlagenView } from './views/VorlagenView';
import { MeetingsView } from './views/MeetingsView';
import { VertraegeView } from './views/VertraegeView';
import { PoliciesView } from './views/PoliciesView';

const VIEW_MAP: Record<OfficeAreaId, React.ComponentType> = {
  documents: DokumenteView,
  sheets: TabellenView,
  presentations: PraesentationenView,
  templates: VorlagenView,
  meetings: MeetingsView,
  contracts: VertraegeView,
  policies: PoliciesView,
};

export function OfficeWorkspace() {
  const { section } = useParams<{ section: string }>();
  const area = findOfficeArea(section);

  if (!area) {
    // Unbekannte Section → zurück zum Office-Hub.
    return <Navigate to={OFFICE_BASE_ROUTE} replace />;
  }

  const View = VIEW_MAP[area.id];
  return (
    <OfficeShell active={area.id}>
      <View />
    </OfficeShell>
  );
}
