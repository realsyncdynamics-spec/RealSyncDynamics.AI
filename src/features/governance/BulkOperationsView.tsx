import { Link } from 'react-router-dom';
import { ArrowLeft, Construction, Layers } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from './withPerformanceMonitoring';

/**
 * /app/governance/bulk-operations — Massen-Import (Gaps, Evidence, Status).
 *
 * ## Warum hier so wenig steht
 *
 * Bis 2026-09-14 sah diese Seite vollständig aus: Upload-Zone, vier Job-Typen,
 * eine Job-Historie. Nichts davon existierte. Die Historie war im Quelltext
 * festgeschrieben — `q2-vulnerability-scan.csv`, 248 Zeilen, abgeschlossen am
 * 04.07.2026 — und wurde jedem Mandanten als *seine* Historie gezeigt. Die
 * ausgewählte Datei wurde nie hochgeladen; `totalRows` des neuen Jobs kam aus
 * `Math.floor(Math.random() * 300) + 50`, der Status `processing` war reiner
 * React-State und nach einem Reload verschwunden.
 *
 * In einem Compliance-Produkt ist das kein kosmetisches Problem: erfundene
 * Import-Historie sieht aus wie Nachweis. Solange es kein Backend für
 * Massen-Importe gibt, sagt die Fläche genau das — statt ein Ergebnis zu
 * behaupten, das sie nicht liefern kann.
 *
 * Der Massen-Scan vieler Domains ist davon unberührt: der läuft unter
 * `/app/bulk` serverseitig über `features/bulk/bulkApi`.
 */
function _BulkOperationsView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const BulkOperationsView = withPerformanceMonitoring(
  _BulkOperationsView,
  'BulkOperationsView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  return (
    <div className="min-h-screen bg-obsidian-950">
      <header className="border-b border-titanium-800 px-6 py-4">
        <Link
          to="/app/dashboard"
          className="inline-flex items-center gap-2 text-sm text-titanium-400 hover:text-titanium-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Übersicht
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-titanium-50">Massen-Import</h1>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-2xl border border-titanium-800 bg-obsidian-900 p-6">
          <div className="flex items-center gap-3 text-amber-400">
            <Construction className="h-5 w-5" />
            <h2 className="font-semibold">Noch nicht verfügbar</h2>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-titanium-300">
            Massen-Importe von CSV- und ZIP-Dateien sowie gemeinsame
            Status-Updates stehen derzeit noch nicht zur Verfügung.
          </p>

          <p className="mt-3 text-sm leading-relaxed text-titanium-400">
            Mehrere Websites können Sie bereits gemeinsam prüfen lassen.
            Öffnen Sie dafür die Bulk-Jobs und verfolgen Sie dort Ihre Aufträge
            und Ergebnisse.
          </p>

          <Link
            to="/app/bulk"
            className="mt-5 inline-flex items-center gap-2 border border-titanium-700 px-4 py-2 text-sm text-titanium-100 hover:bg-obsidian-800"
          >
            <Layers className="h-4 w-4" />
            Zu den Bulk-Jobs
          </Link>
        </div>
      </main>
    </div>
  );
}
