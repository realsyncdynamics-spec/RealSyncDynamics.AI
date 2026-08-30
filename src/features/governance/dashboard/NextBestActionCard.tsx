/**
 * Ein Auftrag auf der Übersicht: Befunde, Empfehlung, CTA.
 * Marketplace bleibt Capability Store — hier steht der nächste Schritt.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import { useTenant } from '../../../core/access/TenantProvider';
import { useEntitlements } from '../../../core/billing/useEntitlements';
import { recommendForProfile } from '../../../core/onboarding/canonicalRecommendation';
import { classifyAllFindings, groupFindingsByDimension, scoreDimensionCriticality } from '../../../core/onboarding/findingClassifier';
import { nextBestOffer, type NextBestOffer } from '../../../core/onboarding/nextBestAction';
import { claimPendingAudit } from '../../../core/onboarding/claimAudit';
import type { GovernanceProfile, ScanFinding, Sector } from '../../../core/onboarding/types';
import { formatPriceEur, planById } from '@/shared/pricing';

interface ClaimedAuditRow {
  id: string;
  domain: string;
  issues: unknown;
  severity: string;
}

function findingsFromIssues(issues: unknown): ScanFinding[] {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      id: String(row.id ?? ''),
      severity: (typeof row.severity === 'string' ? row.severity : 'info') as ScanFinding['severity'],
      title: String(row.title ?? row.id ?? ''),
      detail: String(row.detail ?? ''),
      paragraph_ref: typeof row.paragraph_ref === 'string' ? row.paragraph_ref : undefined,
    }))
    .filter((f) => f.id);
}

function profileFromAudit(row: ClaimedAuditRow): GovernanceProfile {
  const findings = findingsFromIssues(row.issues);
  const classified = classifyAllFindings(findings);
  const grouped = groupFindingsByDimension(classified);
  const dimensions = Array.from(grouped.keys()).map((dim) => {
    const score = scoreDimensionCriticality(classified, dim);
    return {
      dimension: dim,
      criticalityScore: score,
      needsAddressing: grouped.get(dim)!.some((f) => f.urgency !== 'eventual'),
      recommendedPlan: (score >= 70 ? 'agency' : score >= 40 ? 'growth' : 'starter') as GovernanceProfile['dimensions'][number]['recommendedPlan'],
    };
  });
  const riskLevel = classified.some((f) => f.original.severity === 'critical')
    ? 'critical'
    : classified.some((f) => f.original.severity === 'high')
      ? 'high'
      : classified.some((f) => f.original.severity === 'medium')
        ? 'medium'
        : 'low';
  return {
    scanId: row.id,
    domain: row.domain,
    sector: 'generic' as Sector,
    riskLevel,
    findings: classified,
    answers: [],
    dimensions,
  };
}

export function NextBestActionCard() {
  const { activeTenantId } = useTenant();
  const { tier, loading: entitlementsLoading } = useEntitlements();
  const [offer, setOffer] = useState<NextBestOffer | null>(null);
  const [domain, setDomain] = useState('');

  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) return;
    let cancelled = false;

    void (async () => {
      try {
        await claimPendingAudit().catch(() => null);
        const sb = getSupabase();
        const { data, error: queryError } = await sb
          .from('gdpr_audits')
          .select('id, domain, issues, severity')
          .eq('tenant_id', activeTenantId)
          .not('claimed_at', 'is', null)
          .order('claimed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (queryError) {
          return;
        }
        if (!data) {
          setOffer(null);
          return;
        }
        const row = data as ClaimedAuditRow;
        const rec = recommendForProfile(profileFromAudit(row));
        setDomain(row.domain);
        setOffer(nextBestOffer({
          rec,
          currentPlan: tier,
          auditId: row.id,
          domain: row.domain,
        }));
      } catch {
        if (!cancelled) setOffer(null);
      }
    })();

    return () => { cancelled = true; };
  }, [activeTenantId, tier]);

  if (entitlementsLoading || !offer) return null;

  const plan = planById(offer.plan);
  const topFindings = offer.findings.slice(0, 3);

  return (
    <section className="mb-8 w-full max-w-2xl text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        Dein nächster Schritt
      </p>
      {domain && (
        <p className="mt-1 text-xs text-slate-500">Scan für {domain}</p>
      )}
      {topFindings.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {topFindings.map((f) => (
            <li key={f.label} className="text-sm text-slate-800">
              {f.label}
              {f.reason ? <span className="block text-xs text-slate-500">{f.reason}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {offer.mode === 'expand' && (
        <p className="mt-3 text-sm text-slate-600">
          {offer.expansionIds.length > 0
            ? 'Nächster Ausbau aus dem Katalog — der Plan trägt das Fundament bereits.'
            : 'Alle empfohlenen Dienste sind in diesem Plan enthalten.'}
        </p>
      )}
      {offer.mode === 'activate_plan' && (
        <p className="mt-3 text-sm text-slate-600">
          Empfohlen: {plan.name} · {formatPriceEur(plan.price.monthlyEur)} / Monat
        </p>
      )}
      {offer.mode === 'review' && (
        <p className="mt-3 text-sm text-slate-600">
          Der Scan reicht für eine verbindliche Umsetzung noch nicht. Erst die Empfehlung prüfen.
        </p>
      )}
      {offer.modules.length > 0 && offer.mode !== 'expand' && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {offer.modules.slice(0, 4).map((m) => (
            <li key={m.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              {m.name}
            </li>
          ))}
        </ul>
      )}
      <Link
        to={offer.ctaHref}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        {offer.ctaLabel} <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}
