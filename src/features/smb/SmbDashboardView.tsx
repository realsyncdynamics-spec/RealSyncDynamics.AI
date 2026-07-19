import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  Eye,
  FileCheck2,
  HeartPulse,
  Lightbulb,
  Mail,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { SMB_TILES, type SmbTileDefinition, type SmbTileId } from '../../config/smb-experience';
import { useSmbBusinessData } from './useSmbBusinessData';
import {
  buildRecommendations,
  monitoringSignal,
  privacyAutopilot,
  securityStatus,
  trustSignal,
  visibilitySignal,
  websiteHealth,
  type BusinessGrade,
  type BusinessSignal,
} from './lib/businessSignals';

/**
 * SmbDashboardView — das Dashboard der SMB Experience Layer.
 *
 * Zielgruppe: Einzelunternehmer und kleine Unternehmen (1–10 Mitarbeiter).
 * Regeln:
 *  - Maximal 8 Hauptkacheln (aktuell 6, definiert in src/config/smb-experience.ts).
 *  - Keine Fachbegriffe auf der Oberfläche — nur geschäftlicher Mehrwert.
 *  - Konsumiert ausschließlich bestehende Services (siehe useSmbBusinessData).
 *  - Design: „European Enterprise Trust" Light-Theme (Slate + Petrol,
 *    rounded-card/chip) — bewusst freundlicher als die Enterprise-Ansicht.
 *
 * Die vollwertige Enterprise-Ansicht bleibt unverändert unter /app/dashboard
 * erreichbar („Expertenansicht").
 */

const TILE_ICONS: Record<SmbTileId, typeof Shield> = {
  'website-health': HeartPulse,
  monitoring: Activity,
  security: Shield,
  'privacy-autopilot': ShieldCheck,
  visibility: Eye,
  trust: FileCheck2,
};

const GRADE_STYLES: Record<BusinessGrade, { chip: string; label: string }> = {
  gut: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Gut' },
  okay: { chip: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Okay' },
  handeln: { chip: 'bg-red-50 text-red-700 border-red-200', label: 'Bitte kümmern' },
};

function TileCard({ tile, signal }: { tile: SmbTileDefinition; signal: BusinessSignal }) {
  const Icon = TILE_ICONS[tile.id];
  const grade = GRADE_STYLES[signal.grade];
  return (
    <div className="bg-white border border-slate-200 rounded-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-chip bg-petrol-50 text-petrol-700 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5" aria-hidden />
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{tile.title}</h3>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-chip border ${grade.chip}`}>
          {grade.label}
        </span>
      </div>

      <div>
        <p className="text-lg font-semibold text-slate-900 leading-snug">
          {typeof signal.value === 'number' && tile.id === 'website-health'
            ? `${signal.value} von 100`
            : signal.headline}
        </p>
        {typeof signal.value === 'number' && tile.id === 'website-health' && (
          <p className="text-sm text-slate-600 mt-0.5">{signal.headline}</p>
        )}
      </div>

      <p className="text-sm text-slate-600 leading-relaxed flex-1">{signal.detail}</p>

      <details className="group">
        <summary className="text-xs text-petrol-700 cursor-pointer select-none list-none hover:underline">
          Was heißt das?
        </summary>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">{tile.explanation}</p>
      </details>
    </div>
  );
}

export function SmbDashboardView() {
  const data = useSmbBusinessData();

  // Kachel-Signale: pro Kachel-ID das passende Business-Signal aus den
  // aggregierten Plattformdaten (pure Funktionen, siehe lib/businessSignals).
  const signals: Record<SmbTileId, BusinessSignal> = {
    'website-health': websiteHealth({ auditScore: data.auditScore, severities: data.severities }),
    monitoring: monitoringSignal(data.eventsLast30d),
    security: securityStatus(data.severities),
    'privacy-autopilot': privacyAutopilot(data.evidenceCount),
    visibility: visibilitySignal(data.auditScore),
    trust: trustSignal(data.evidenceCount),
  };

  const recommendations = buildRecommendations(data.rawFindings);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Kopfbereich */}
        <header className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Mein Geschäft im Blick
              </h1>
              <p className="text-slate-600 mt-1.5 max-w-xl">
                Alles Wichtige zu Ihrer Website auf einen Blick — verständlich, ohne Fachbegriffe.
                {data.auditDomain && data.live && (
                  <>
                    {' '}
                    Zuletzt geprüft: <span className="font-medium text-slate-800">{data.auditDomain}</span>
                  </>
                )}
              </p>
            </div>
            <Link
              to="/app/dashboard"
              className="text-sm text-slate-500 hover:text-petrol-700 border border-slate-200 rounded-chip px-3 py-1.5 bg-white transition-colors"
            >
              Zur Expertenansicht
            </Link>
          </div>

          {!data.loading && !data.live && (
            <p className="mt-4 text-sm text-slate-600 bg-white border border-slate-200 rounded-chip px-3.5 py-2.5 inline-block">
              Sie sehen ein Beispiel. Sobald Ihre Website verbunden ist, erscheinen hier Ihre echten Zahlen —{' '}
              <Link to="/audit" className="text-petrol-700 font-medium hover:underline">
                jetzt kostenlosen Website-Check starten
              </Link>
              .
            </p>
          )}
        </header>

        {/* Hauptkacheln (max. 8, siehe src/config/smb-experience.ts) */}
        {data.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy>
            {SMB_TILES.map((tile) => (
              <div key={tile.id} className="bg-white border border-slate-200 rounded-card p-5 h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SMB_TILES.map((tile) => (
              <TileCard key={tile.id} tile={tile} signal={signals[tile.id]} />
            ))}
          </div>
        )}

        {/* Automatische Handlungsempfehlungen */}
        <section className="mt-8 bg-white border border-slate-200 rounded-card p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="w-9 h-9 rounded-chip bg-petrol-50 text-petrol-700 flex items-center justify-center">
              <Lightbulb className="w-4.5 h-4.5" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-slate-900">Das bringt Sie jetzt weiter</h2>
          </div>
          <ul className="space-y-3">
            {recommendations.map((rec) => (
              <li key={rec} className="flex items-start gap-3">
                <CheckCircle2 className="w-4.5 h-4.5 text-petrol-600 shrink-0 mt-0.5" aria-hidden />
                <span className="text-sm text-slate-700 leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Monatlicher Gesundheitsbericht */}
        <section className="mt-4 bg-petrol-700 text-white rounded-card p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 shrink-0" aria-hidden />
            <div>
              <h2 className="text-base font-semibold">Ihr monatlicher Gesundheitsbericht</h2>
              <p className="text-sm text-petrol-100 mt-0.5">
                Einmal im Monat fassen wir zusammen, wie es Ihrer Website geht — kurz, verständlich, per E-Mail.
              </p>
            </div>
          </div>
          <Link
            to="/app/settings"
            className="text-sm font-medium bg-white text-petrol-700 rounded-chip px-4 py-2 hover:bg-petrol-50 transition-colors"
          >
            Bericht aktivieren
          </Link>
        </section>
      </div>
    </div>
  );
}
