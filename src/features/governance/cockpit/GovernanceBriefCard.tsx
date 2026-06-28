// GovernanceBriefCard — zeigt den jüngsten Hermes-Tagesbrief im CEO-Cockpit.
//
// Eigenständig + resilient: lädt selbst über fetchLatestBrief; ohne Brief
// (oder ohne Session/Env) rendert die Karte nichts (kein Platzhalter-Rauschen).
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { Card, CardHeader, CardBody } from '../../../enterprise-os/components/Card';
import { StatusBadge } from '../../../enterprise-os/components/Badge';
import { fetchLatestBrief, type DailyBrief } from './briefsApi';

type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'passed';
function riskLevel(s?: string): RiskLevel {
  const v = (s ?? '').toLowerCase();
  return (['critical', 'high', 'medium', 'low'] as string[]).includes(v) ? (v as RiskLevel) : 'medium';
}

export function GovernanceBriefCard() {
  const { activeTenantId } = useTenant();
  const [brief, setBrief] = useState<DailyBrief | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!activeTenantId) { setBrief(null); return; }
    fetchLatestBrief(activeTenantId)
      .then((b) => { if (!cancelled) setBrief(b); })
      .catch(() => { if (!cancelled) setBrief(null); });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  if (!brief || !brief.narrative_de) return null;

  return (
    <Card className="bg-obsidian-900">
      <CardHeader
        eyebrow="Hermes · Tagesbrief"
        title="Governance-Brief"
        subtitle={`Stand ${brief.brief_date} · automatisch erzeugt`}
        action={<Sparkles className="h-4 w-4 text-security-500" />}
      />
      <CardBody className="space-y-4">
        <p className="text-sm leading-relaxed text-titanium-200">{brief.narrative_de}</p>

        {brief.top_3_risks.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500 mb-2">Top-Risiken</p>
            <ul className="space-y-1.5">
              {brief.top_3_risks.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <StatusBadge level={riskLevel(r.severity)} />
                  <span className="text-xs text-titanium-200">{r.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.recommended_actions_today.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-500 mb-2">Heute empfohlen</p>
            <ul className="space-y-1 list-disc list-inside">
              {brief.recommended_actions_today.map((a, i) => (
                <li key={i} className="text-xs text-titanium-300">{a}</li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
