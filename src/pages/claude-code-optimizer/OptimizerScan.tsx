import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Globe, Mail, Loader2, AlertTriangle, Search } from 'lucide-react';
import { usePageMeta } from '../../lib/usePageMeta';
import { postEdgeFunction } from '../../lib/edgeFunction';
import { getAffiliateRef } from '../../lib/affiliate';
import { LegalDisclaimer } from '../../components/LegalDisclaimer';
import {
  OptimizerShell,
  IntroBanner,
  PrimaryButton,
  stepById,
  saveScanResult,
  type OptimizerScanResult,
  type OptimizerFinding,
} from './OptimizerKit';

/**
 * Schritt 2 — Scan (Aktionsseite).
 *
 * Erklärt: „Du gibst deine URL ein → wir scannen → du bekommst deine Fehler."
 * Nutzt dieselbe Edge Function (`gdpr-audit`) wie der freie Audit. Nach dem
 * Scan wird das Ergebnis persistiert und der Kunde zur Ergebnisseite geleitet.
 */

// Backend-Antwort von `gdpr-audit` (Teilmenge, die wir hier brauchen).
interface AuditReport {
  audit_id: string;
  domain: string;
  email?: string;
  score: number;
  severity: string;
  created_at?: string;
  issues: Array<{
    id: string;
    severity: OptimizerFinding['severity'];
    title: string;
    detail: string;
    paragraph_ref?: string;
  }>;
}

export function OptimizerScan() {
  const navigate = useNavigate();
  usePageMeta({
    title: 'Website scannen — Claude Code Optimizer',
    description: 'URL eingeben, in ~30 Sekunden die Compliance- und Code-Fehler deiner Website erhalten.',
    url: 'https://RealSyncDynamicsAI.de/claude-code-optimizer/scan',
  });

  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalizedUrl = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
      const report = await postEdgeFunction<AuditReport>('gdpr-audit', {
        url: normalizedUrl,
        email: email.trim(),
        referral_code: getAffiliateRef() || undefined,
        source: 'claude_code_optimizer',
      });

      const result: OptimizerScanResult = {
        auditId: report.audit_id,
        domain: report.domain,
        email: report.email || email.trim() || undefined,
        score: report.score,
        severity: report.severity,
        createdAt: report.created_at,
        findings: (report.issues ?? []).map((i) => ({
          id: i.id,
          severity: i.severity,
          title: i.title,
          detail: i.detail,
          paragraph_ref: i.paragraph_ref,
        })),
      };

      saveScanResult(result);
      navigate(stepById('ergebnis').path, { state: result });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OptimizerShell step="scan" backTo={stepById('ueberblick').path}>
      <IntroBanner
        kind="aktion"
        eyebrow="Schritt 2 von 5"
        title="Deine Website scannen"
        nextActionLabel="Nach dem Klick auf »Jetzt scannen« analysieren wir deine Seite und leiten dich automatisch zur Ergebnisseite mit deiner Fehlerliste weiter."
      >
        <p>
          Gib die URL deiner Website ein. Der Optimizer prüft sie einmalig auf typische Compliance-
          und Code-Fehler — Tracking ohne Einwilligung, fehlende Pflichtangaben, Cookie-Dark-Patterns
          und mehr. Es werden keine Inhalte deiner Seite gespeichert.
        </p>
        <p className="text-titanium-400">
          Deine E-Mail brauchen wir, um dir den späteren ausführlichen Bericht zuzustellen.
        </p>
      </IntroBanner>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-8 rounded-none space-y-4"
      >
        <label className="block">
          <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Deine Website-URL <span className="text-red-400">*</span>
          </span>
          <input
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="meine-website.de"
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-base sm:text-sm rounded-none outline-none focus:border-cyan-500"
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> E-Mail (für den Bericht) <span className="text-red-400">*</span>
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dein@unternehmen.de"
            autoComplete="email"
            className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-base sm:text-sm rounded-none outline-none focus:border-cyan-500"
          />
        </label>

        <PrimaryButton type="submit" disabled={loading || !url || !email} className="w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Scan läuft …
            </>
          ) : (
            <>
              <Search className="h-4 w-4" /> Jetzt scannen <ArrowRight className="h-4 w-4" />
            </>
          )}
        </PrimaryButton>

        <div className="pt-1">
          <LegalDisclaimer context="audit" />
        </div>
      </form>
    </OptimizerShell>
  );
}
