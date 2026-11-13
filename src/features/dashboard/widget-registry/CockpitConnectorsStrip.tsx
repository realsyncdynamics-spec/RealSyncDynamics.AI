import { WIDGET_CATALOG } from './catalog';
import { isWidgetFeatureEnabled } from './flags';

/**
 * Checkliste der Start-Kontoanbindungen im Command Center.
 * Rein deklarativ: kein OAuth-Start, keine Token-Speicherung.
 * Gmail bleibt ausgeblendet, solange das CASA-Flag aus ist.
 */
export function CockpitConnectorsStrip() {
  const connectors = WIDGET_CATALOG.filter((widget) => {
    if (widget.startConnector !== true) return false;
    if (widget.featureFlag && !isWidgetFeatureEnabled(widget.featureFlag)) return false;
    return true;
  });

  return (
    <section className="rs-panel" data-testid="cockpit-connectors-strip" aria-labelledby="cockpit-connectors-title">
      <h2 id="cockpit-connectors-title" className="rs-h3">Konten verbinden</h2>
      <p className="rs-note">
        Start-Set: Google Calendar, Microsoft Calendar, Outlook Mail über Microsoft Graph und Social.
        Die Anbindung selbst folgt in einem späteren PR; hier nur die Checkliste. Gmail (Restricted Scopes)
        ist bis zur Google-CASA-Verifizierung gesperrt und wird nicht angeboten.
      </p>
      <ul className="rs-start__steps">
        {connectors.map((widget) => (
          <li key={widget.id} className="rs-start__step" data-connector-id={widget.id}>
            <span className="min-w-0 flex-1">
              <strong>{widget.title}</strong>
              <span className="rs-note"> — geplant, noch nicht anbindbar</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
