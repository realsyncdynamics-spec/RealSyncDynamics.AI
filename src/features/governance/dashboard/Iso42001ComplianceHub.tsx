import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, AlertTriangle, CheckCircle2, Clock, Lock, ArrowRight } from 'lucide-react';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { useTenant } from '../../../core/access/TenantProvider';
import { FeatureGate } from '../../../core/billing/FeatureGate';

interface ComplianceItem {
  id: string;
  title: string;
  description: string;
  status: 'compliant' | 'in-progress' | 'non-compliant' | 'not-applicable';
  dueDate?: Date;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

const PLACEHOLDER_CONTROLS: ComplianceItem[] = [
  {
    id: 'ams-1',
    title: 'AI-System Dokumentation',
    description: 'Alle KI-Systeme müssen dokumentiert sein mit Zweck und Risiko',
    status: 'in-progress',
    dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    riskLevel: 'high',
  },
  {
    id: 'ams-2',
    title: 'Risiko-Bewertung durchgeführt',
    description: 'Jedes KI-System muss einer umfassenden Risikobewertung unterzogen werden',
    status: 'in-progress',
    dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    riskLevel: 'critical',
  },
  {
    id: 'ams-3',
    title: 'Trainingsdaten-Qualität',
    description: 'Sicherstellung hoher Qualität und Repräsentativität der Trainingsdaten',
    status: 'compliant',
    riskLevel: 'medium',
  },
  {
    id: 'ams-4',
    title: 'Menschliche Übersicht',
    description: 'Implementierung von Mechanismen für menschliche Überwachung und Intervention',
    status: 'not-applicable',
    riskLevel: 'low',
  },
];

const STATUS_CONFIG = {
  compliant: {
    label: 'Konform',
    color: 'emerald',
    icon: CheckCircle2,
  },
  'in-progress': {
    label: 'In Arbeit',
    color: 'amber',
    icon: Clock,
  },
  'non-compliant': {
    label: 'Nicht konform',
    color: 'rose',
    icon: AlertTriangle,
  },
  'not-applicable': {
    label: 'Nicht anwendbar',
    color: 'titanium',
    icon: CheckCircle2,
  },
};

const RISK_CONFIG = {
  critical: { label: 'Kritisch', color: 'rose' },
  high: { label: 'Hoch', color: 'orange' },
  medium: { label: 'Mittel', color: 'amber' },
  low: { label: 'Niedrig', color: 'emerald' },
};

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
  const { activeTenantId } = useTenant();
  const [controls, setControls] = useState<ComplianceItem[]>(PLACEHOLDER_CONTROLS);

  const complianceCount = controls.filter((c) => c.status === 'compliant').length;
  const totalCount = controls.length;
  const compliancePercent = Math.round((complianceCount / totalCount) * 100);

  const criticalItems = controls.filter(
    (c) => c.riskLevel === 'critical' && c.status !== 'compliant'
  );

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <button
          onClick={() => navigate('/app/governance')}
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
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-6 rounded-none">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-1" />
            <div>
              <h1 className="text-2xl font-bold text-titanium-50 mb-2">
                ISO 42001 Compliance Hub
              </h1>
              <p className="text-sm text-titanium-400 mb-4">
                Verwalte deine KI-Systeme nach ISO 42001 Standard. Sicherstelle, dass alle
                KI-Assets dokumentiert, bewertet und konform mit den Anforderungen sind.
              </p>
              {tier !== 'enterprise' && tier !== 'scale' && tier !== 'agency' && (
                <p className="text-xs text-amber-300 flex items-center gap-2">
                  <Lock className="w-3 h-3" />
                  Verfügbar ab Growth-Plan
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">GESAMTKONFORMITÄT</p>
            <p className="text-2xl font-bold text-emerald-400">{compliancePercent}%</p>
            <div className="mt-2 w-full bg-titanium-900 h-2 rounded-none overflow-hidden">
              <div
                className="bg-emerald-400 h-full transition-all"
                style={{ width: `${compliancePercent}%` }}
              />
            </div>
          </div>
          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">KONFORME KONTROLLEN</p>
            <p className="text-2xl font-bold text-titanium-300">{complianceCount}/{totalCount}</p>
          </div>
          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">KRITISCHE PROBLEME</p>
            <p className="text-2xl font-bold text-rose-400">{criticalItems.length}</p>
          </div>
          <div className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none">
            <p className="text-xs text-titanium-500 font-mono mb-2">LAST UPDATED</p>
            <p className="text-sm text-titanium-400">Vor 2 Stunden</p>
          </div>
        </div>

        {/* Critical Issues Alert */}
        {criticalItems.length > 0 && (
          <div className="bg-rose-950/30 border border-rose-500/30 p-4 rounded-none">
            <h3 className="text-sm font-semibold text-rose-300 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {criticalItems.length} kritische Probleme
            </h3>
            <div className="space-y-2">
              {criticalItems.map((item) => (
                <div key={item.id} className="text-xs text-rose-200 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-rose-400 rounded-full" />
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls List */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-titanium-50">Kontrollpunkte</h2>
          {controls.map((control) => {
            const statusConfig = STATUS_CONFIG[control.status];
            const riskConfig = RISK_CONFIG[control.riskLevel];
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={control.id}
                className="bg-obsidian-900 border border-titanium-800 p-4 rounded-none hover:border-titanium-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-2 h-2 rounded-full mt-2 bg-${riskConfig.color}-500`} />
                    <div className="flex-1">
                      <h3 className="font-semibold text-titanium-50 text-sm mb-1">
                        {control.title}
                      </h3>
                      <p className="text-xs text-titanium-400">
                        {control.description}
                      </p>
                    </div>
                  </div>
                  <StatusIcon className={`w-4 h-4 text-${statusConfig.color}-400 shrink-0`} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono px-2 py-1 rounded-none bg-${statusConfig.color}-500/10 text-${statusConfig.color}-300`}>
                      {statusConfig.label}
                    </span>
                    <span className={`text-xs font-mono px-2 py-1 rounded-none bg-${riskConfig.color}-500/10 text-${riskConfig.color}-300`}>
                      {riskConfig.label}
                    </span>
                  </div>
                  {control.dueDate && (
                    <div className="text-xs text-titanium-500">
                      Fällig: {control.dueDate.toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action CTA */}
        <div className="bg-obsidian-900 border border-ai-cyan-500/30 p-6 rounded-none text-center space-y-4">
          <Zap className="w-8 h-8 text-ai-cyan-400 mx-auto" />
          <div>
            <h3 className="text-lg font-semibold text-titanium-50 mb-2">
              Zusätzliche Funktionen freischalten
            </h3>
            <p className="text-sm text-titanium-400 max-w-md mx-auto">
              Mit dem Partner-Plan erhalten Sie erweiterte ISO 42001 Reporting-Features,
              automatische Compliance-Audits und Zertifizierungsvorbereitung.
            </p>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-ai-cyan-500 hover:bg-ai-cyan-600 text-obsidian-950 font-semibold rounded-none transition-colors"
          >
            <Zap className="w-4 h-4" />
            Jetzt upgraden
          </button>
        </div>
      </main>
    </div>
  );
}
