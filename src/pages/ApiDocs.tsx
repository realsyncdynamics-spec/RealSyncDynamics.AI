import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Code2, Key, FileText, AlertTriangle } from 'lucide-react';

type Endpoint = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  desc: string;
  auth: 'bearer' | 'none';
  example?: string;
};

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST',
    path: '/functions/v1/audit',
    desc: 'Website-Audit triggern (DSGVO-Score, fehlende Pflichtangaben, Cookie-Banner-Check)',
    auth: 'none',
    example: '{ "url": "https://example.com" }',
  },
  {
    method: 'GET',
    path: '/functions/v1/audit?id=<uuid>',
    desc: 'Bestehenden Audit-Report abrufen (mit Vergleich zu Vorrun)',
    auth: 'bearer',
  },
  {
    method: 'POST',
    path: '/functions/v1/avv-generator',
    desc: 'AVV-Vorlage generieren (Auftragsverarbeiter-Vertrag, PDF + Markdown)',
    auth: 'bearer',
    example: '{ "tenant_id": "...", "processor": "Stripe Payments Europe Ltd." }',
  },
  {
    method: 'POST',
    path: '/functions/v1/ai-act-classify',
    desc: 'AI-Act-Risiko-Klassifikation für einen Use-Case (Limited / High / Prohibited)',
    auth: 'bearer',
    example: '{ "use_case": "Bewerber-Vorauswahl", "domain": "HR" }',
  },
  {
    method: 'POST',
    path: '/functions/v1/dsfa',
    desc: 'DSFA-Wizard-Entwurf für Art. 35 DSGVO Use-Case',
    auth: 'bearer',
  },
  {
    method: 'GET',
    path: '/functions/v1/sub-processors',
    desc: 'Sub-Processors-Liste deines Tenants als JSON (für Customer-Selfservice)',
    auth: 'bearer',
  },
  {
    method: 'POST',
    path: '/functions/v1/sales-lead',
    desc: 'Lead-Capture (rate-limited, IP-Hash-Anonymisierung)',
    auth: 'none',
    example: '{ "email": "...", "company": "...", "source": "audit" }',
  },
  {
    method: 'POST',
    path: '/functions/v1/newsletter-subscribe',
    desc: 'Newsletter-Subscribe (Double-Opt-In nach § 7 UWG)',
    auth: 'none',
  },
  {
    method: 'POST',
    path: '/functions/v1/gdpr-export',
    desc: 'DSGVO Art. 15 Datenexport (maschinenlesbares JSON, Art. 20 konform)',
    auth: 'bearer',
  },
  {
    method: 'DELETE',
    path: '/functions/v1/gdpr-delete',
    desc: 'DSGVO Art. 17 Account-Löschung (kaskadiert über alle Tenants)',
    auth: 'bearer',
  },
  {
    method: 'POST',
    path: '/functions/v1/workflow-trigger',
    desc: 'n8n-Workflow triggern (mit Tenant-Scope, Audit-Log)',
    auth: 'bearer',
  },
  {
    method: 'POST',
    path: '/functions/v1/ai-invoke',
    desc: 'KI-Aufruf mit Provider-Routing (Anthropic / Google / OpenAI / Ollama). Audit-Trail automatisch.',
    auth: 'bearer',
    example: '{ "model": "auto-eu", "prompt": "...", "tenant_id": "..." }',
  },
];

const METHOD_COLOR: Record<Endpoint['method'], string> = {
  GET: 'text-emerald-400 border-emerald-900 bg-emerald-950/40',
  POST: 'text-amber-400 border-amber-900 bg-amber-950/40',
  DELETE: 'text-red-400 border-red-900 bg-red-950/40',
};

export function ApiDocs() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center">
            <Code2 className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">API-Docs</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-cyan-900 bg-cyan-950/30 text-cyan-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Code2 className="h-3 w-3" /> Public Endpoints · REST · JSON · Bearer-Auth
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              API — programmatischer Zugriff
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Im Silver-Tier inklusive. Tenant-scoped API-Keys, Rate-Limits, Audit-Log pro Aufruf.
              Base-URL: <code className="px-1 bg-obsidian-900 text-emerald-300 text-xs font-mono">https://&lt;project&gt;.supabase.co</code>
            </p>
          </div>

          <Section title="Authentifizierung" icon={<Key className="h-5 w-5 text-security-400" />}>
            <p>API-Key generierst du unter <Link to="/settings/api-keys" className="text-security-400">/settings/api-keys</Link>. Header-Format:</p>
            <div className="p-3 bg-obsidian-950 border border-titanium-700 rounded-none">
              <code className="text-emerald-300 text-xs font-mono leading-relaxed block">
                Authorization: Bearer rsd_live_&lt;your-key&gt;<br />
                Content-Type: application/json
              </code>
            </div>
            <ul className="space-y-1.5 text-sm mt-3">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Key ist tenant-scoped — kann nur Daten lesen/schreiben, die zum Tenant gehören</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Rate-Limits: Bronze 60/min, Silver 600/min, Gold 6000/min</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Bei 429: <code className="text-amber-300 text-xs">Retry-After</code>-Header wird gesetzt</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span>Public-Endpoints (audit, sales-lead, newsletter) brauchen keinen Key — IP-Rate-Limit greift</span></li>
            </ul>
          </Section>

          <Section title="Endpoints" icon={<FileText className="h-5 w-5 text-security-400" />}>
            <div className="space-y-2">
              {ENDPOINTS.map((e) => (
                <div key={e.path + e.method} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider border rounded-none shrink-0 ${METHOD_COLOR[e.method]}`}>
                      {e.method}
                    </span>
                    <code className="text-titanium-100 text-sm font-mono">{e.path}</code>
                    <span className="text-[10px] uppercase tracking-wider text-titanium-500 font-bold ml-auto">
                      {e.auth === 'bearer' ? '🔒 Bearer' : '· Public'}
                    </span>
                  </div>
                  <p className="text-xs text-titanium-400 leading-relaxed mt-2">{e.desc}</p>
                  {e.example && (
                    <div className="p-2 bg-obsidian-950 border border-titanium-800 rounded-none mt-2">
                      <code className="text-emerald-300 text-[11px] font-mono leading-relaxed">{e.example}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Webhooks" icon={<Code2 className="h-5 w-5 text-security-400" />}>
            <p>Outbound Webhooks für deinen eigenen Stack:</p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><code className="text-emerald-300 text-xs">audit.completed</code> — Audit-Run fertig, mit Score-Delta zur Vorrun</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><code className="text-emerald-300 text-xs">sub_processor.changed</code> — Sub-Processor-Liste geändert (Art. 28 Abs. 2 Pflicht-Notification)</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><code className="text-emerald-300 text-xs">incident.reported</code> — 72h-Meldepflicht-Timer gestartet</span></li>
              <li className="flex items-start gap-2"><span className="text-emerald-400 mt-1">•</span><span><code className="text-emerald-300 text-xs">subscription.updated</code> — Stripe-Subscription-State-Change</span></li>
            </ul>
            <p className="text-xs text-titanium-500 mt-2">
              Konfiguration unter <Link to="/settings/api-keys" className="text-security-400">/settings/api-keys</Link>.
              HMAC-SHA256-Signatur per Webhook-Secret, 5x Retry mit Exponential-Backoff.
            </p>
          </Section>

          <Section title="Status &amp; Disclaimer" icon={<AlertTriangle className="h-5 w-5 text-amber-400" />}>
            <p>
              API ist <strong className="text-titanium-50">Beta</strong>. Endpoints können sich ändern,
              Breaking-Changes kündigen wir mindestens 30 Tage vorher in <Link to="/changelog" className="text-security-400">/changelog</Link> an.
              Versionierung via URL-Pfad (<code className="text-emerald-300 text-xs">/functions/v1/…</code>) — nächste Major bekommt /v2/.
            </p>
            <p className="text-xs text-titanium-500">
              SLA für API-Verfügbarkeit aktuell informell (kein vertraglicher SLO).
              Im Gold-/Enterprise-Tier ist 99,5 %/99,9 % SLA verhandelbar.
            </p>
          </Section>

          <div className="mt-12 p-6 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">API-Key generieren</h2>
            <p className="text-titanium-300 text-sm mb-4">
              Im Silver-Tier inklusive. Pilot-Trial 14 Tage, keine Kreditkarte.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/pricing?source=api-docs" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Pilot starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/contact-sales?source=api-docs" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Enterprise-API anfragen
              </Link>
              <Link to="/saas-anbieter" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Für SaaS-Anbieter
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50">{title}</h2>
      </div>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}
