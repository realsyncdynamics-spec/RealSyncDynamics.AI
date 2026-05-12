import { Link } from 'react-router-dom';
import {
  ArrowLeft, Activity, CheckCircle2, AlertTriangle, Clock, ExternalLink,
} from 'lucide-react';

/**
 * /status — public service-status overview.
 *
 * Pre-Production-Phase: noch keine echte Uptime-Monitoring-Pipeline. Diese
 * Seite ist die ehrliche Zwischenlösung — Komponenten + Sub-Processors mit
 * statischer „operational"-Anzeige, plus Hinweis auf das geplante Live-
 * Status-System (Uptime-Kuma oder Better-Stack, M2-Roadmap).
 *
 * Verlinkt vom Footer + Security-Page. Sobald echte Probes laufen, hier
 * dynamisch füllen statt statisch.
 */
export function Status() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Status</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-700 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <CheckCircle2 className="h-3 w-3" /> Alle Systeme operational
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Service-Status
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Komponenten-Übersicht und Incident-Log. Wir publizieren Ausfälle und Wartungsfenster
              ehrlich, sobald sie auftreten — nicht erst, wenn Kunden sie melden.
            </p>
          </div>

          <Section title="Komponenten">
            <ul className="space-y-2">
              <Component name="Frontend (RealSyncDynamicsAI.de)" status="operational" detail="Static SPA, served from Hostinger DE VPS" />
              <Component name="API / Edge Functions" status="operational" detail="Supabase Edge (eu-central-1)" />
              <Component name="Datenbank (Postgres + RLS)" status="operational" detail="Supabase Managed Postgres (eu-central-1)" />
              <Component name="Auth (Magic-Link)" status="operational" detail="Supabase Auth via Email-OTP" />
              <Component name="AI-Provider (Cloud)" status="operational" detail="Anthropic EU + Google Vertex eu-central + OpenAI EU" />
              <Component name="AI-Provider (EU-local Fallback)" status="operational" detail="Ollama auf VPS (Llama 3.1, Mistral)" />
              <Component name="Audit-Engine" status="operational" detail="Versioned rule-engine 2026.05.0" />
              <Component name="Stripe Webhook" status="operational" detail="Idempotent via webhook_events table" />
            </ul>
          </Section>

          <Section title="Sub-Processors">
            <p className="mb-3">
              Alle externen Dienstleister mit Standort und AVV-Status. Vollständige Liste mit
              Zwecken und Datentypen unter{' '}
              <Link to="/legal/sub-processors" className="text-security-400 hover:text-security-300 underline-offset-4 hover:underline">
                /legal/sub-processors
              </Link>
              .
            </p>
            <ul className="space-y-2">
              <Component name="Supabase (Postgres + Edge)" status="operational" detail="DE — Frankfurt eu-central-1" />
              <Component name="Hostinger (VPS-Hosting)" status="operational" detail="DE — Frankfurt" />
              <Component name="Stripe (Payments)" status="operational" detail="EU-Tenant + AVV" />
              <Component name="Anthropic Claude (AI)" status="operational" detail="EU-Endpoint" />
              <Component name="Google Vertex (AI)" status="operational" detail="eu-central · BYOK optional" />
              <Component name="OpenAI (AI, Fallback)" status="operational" detail="EU-Tenant" />
            </ul>
          </Section>

          <Section title="Aktuelle Incidents">
            <div className="p-5 bg-obsidian-900 border border-titanium-900 border-l-2 border-l-emerald-700 rounded-none flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-titanium-50 mb-0.5">Keine offenen Incidents</div>
                <div className="text-sm text-titanium-400">
                  Letzte Aktualisierung: kontinuierlich (statisch in Pre-Production-Phase).
                </div>
              </div>
            </div>
          </Section>

          <Section title="Geplante Wartung">
            <div className="p-5 bg-obsidian-900 border border-titanium-900 rounded-none flex items-start gap-3">
              <Clock className="h-5 w-5 text-titanium-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-titanium-50 mb-0.5">Keine Wartungsfenster geplant</div>
                <div className="text-sm text-titanium-400">
                  Wartungen werden mindestens 72h vorher hier und an alle aktiven Kunden per Email
                  angekündigt.
                </div>
              </div>
            </div>
          </Section>

          <Section title="Wie wir messen (heute)">
            <p>
              <strong className="text-titanium-50">Statische Anzeige.</strong> Es gibt aktuell noch
              keine Live-Monitoring-Pipeline auf dieser Seite. Komponenten-Stati werden manuell
              gepflegt nach Incident-Detection (Sentry, DB-Errors, Webhook-Failures).
            </p>
            <p>
              <strong className="text-titanium-50">M2-Roadmap:</strong> Uptime-Kuma oder Better-Stack
              probt alle 60s die kritischen Endpunkte. Status-Updates dann automatisiert. RSS-Feed
              und Email-Subscribe für Status-Changes folgen.
            </p>
          </Section>

          <Section title="Incident melden">
            <p>
              Falls du eine Störung erlebst, die hier nicht angezeigt wird:{' '}
              <Link to="/contact-sales?source=status-incident" className="text-security-400 hover:text-security-300 underline-offset-4 hover:underline">
                Sales/Support kontaktieren
              </Link>
              .
            </p>
            <p>
              Sicherheitslücken bitte über die{' '}
              <Link to="/security" className="text-security-400 hover:text-security-300 underline-offset-4 hover:underline">
                Security-Disclosure
              </Link>
              {' '}(verantwortliche Offenlegung, 72h-Reaktion).
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/security" className="hover:text-titanium-300">Security</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Processors</Link>
            <Link to="/changelog" className="hover:text-titanium-300">Changelog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

type CompStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';

function Component({ name, status, detail }: { name: string; status: CompStatus; detail?: string }) {
  const config: Record<CompStatus, { Icon: React.ElementType<{ className?: string }>; color: string; label: string }> = {
    operational: { Icon: CheckCircle2,    color: 'text-emerald-400', label: 'Operational' },
    degraded:    { Icon: AlertTriangle,   color: 'text-amber-400',   label: 'Degraded'    },
    outage:      { Icon: AlertTriangle,   color: 'text-red-400',     label: 'Outage'      },
    maintenance: { Icon: Clock,           color: 'text-titanium-400',label: 'Maintenance' },
  };
  const { Icon, color, label } = config[status];
  return (
    <li className="flex items-center justify-between gap-3 p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
      <div className="min-w-0 flex-1">
        <div className="font-display font-bold text-titanium-50 text-sm truncate">{name}</div>
        {detail && <div className="text-xs text-titanium-500 mt-0.5 truncate">{detail}</div>}
      </div>
      <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider ${color}`}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
