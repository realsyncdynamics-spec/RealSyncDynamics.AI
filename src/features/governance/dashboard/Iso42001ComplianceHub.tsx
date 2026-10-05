/**
 * /app/governance/iso-42001-hub — ISO/IEC 42001 (KI-Managementsystem).
 *
 * Ehrlicher Stand: ISO 42001 ist noch nicht als Rahmenwerk hinterlegt
 * (framework_controls kennt es nicht, es gibt keine Zuordnung zu KI-Systemen).
 * Die frühere Fassung zeigte vier fest eingetragene „Kontrollpunkte“ —
 * darunter einen als „Konform“ —, daraus berechnet „Gesamtkonformität 25 %“,
 * Fälligkeiten ab „heute“ und „Last updated: Vor 2 Stunden“. Keine dieser
 * Angaben kam aus Mandantendaten. Jetzt: unzureichende Daten, mit Weg zum
 * echten KI-Inventar, das die Grundlage einer ISO-42001-Bewertung wäre.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Info, Lock } from 'lucide-react';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { FeatureGate } from '../../../core/billing/FeatureGate';
import { hasModule, minimumPlanForModule, planById } from '@/shared/pricing';

export function Iso42001ComplianceHub() {
  return (
    <FeatureGate feature="ai_classification.limited">
      <Inner />
    </FeatureGate>
  );
}

function Inner() {
  const navigate = useNavigate();
  const { tier } = useEntitlements();

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <button
          onClick={() => navigate('/app/dashboard')}
          className="text-titanium-400 hover:text-titanium-200 text-sm"
        >
          ← Zurück zu Governance
        </button>
        <div className="flex-1" />
        <div className="text-xs text-titanium-500 font-mono">
          ISO 42001 · AI Management System
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
          <h1 className="text-2xl font-bold text-titanium-50 mb-2">ISO 42001 Compliance Hub</h1>
          <p className="text-sm text-titanium-400">
            ISO/IEC 42001 beschreibt ein Managementsystem für KI. Eine Bewertung setzt ein
            vollständiges KI-Inventar und erfasste Kontrollpunkte voraus.
          </p>
          {/* Freischaltung folgt dem ISO-27001-Pack der SSoT — kein
              Vergleich gegen Plan-Namen. */}
          {!hasModule(tier, 'iso_27001') && (
            <p className="mt-3 text-xs text-amber-300 flex items-center gap-2">
              <Lock className="w-3 h-3" />
              Verfügbar ab {planById(minimumPlanForModule('iso_27001') ?? 'growth').name}-Plan
            </p>
          )}
        </div>

        <div
          className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none"
          data-testid="iso42001-insufficient-data"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-titanium-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-wider text-titanium-500">Unzureichende Daten</p>
              <p className="text-sm text-titanium-300">
                Für ISO 42001 sind noch keine Kontrollpunkte hinterlegt. Deshalb zeigt diese Seite
                keinen Konformitätsgrad, keine Fälligkeiten und keinen Status — es gibt dafür
                keine Datengrundlage.
              </p>
              <button
                onClick={() => navigate('/app/ai-systems')}
                className="inline-flex items-center gap-2 text-sm text-ai-cyan-400 hover:text-ai-cyan-300"
              >
                Zum KI-Inventar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
