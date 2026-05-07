import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Shield, Lock, Server, FileCheck, AlertOctagon, Mail, CheckCircle2, Clock } from 'lucide-react';

export function Security() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-security-500 to-security-700 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Security</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto space-y-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-security-900 bg-security-950/30 text-security-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Shield className="h-3 w-3" /> Security-Posture · Vulnerability-Disclosure · Roadmap
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Security — <span className="text-security-400">Posture, Roadmap, Disclosure</span>
            </h1>
            <p className="text-lg text-titanium-300 leading-relaxed">
              Was wir heute tun, wo wir Lücken offen kommunizieren, wie du eine Schwachstelle meldest.
              Keine Marketing-Buzzwords — operative Realität.
            </p>
          </div>

          <Section title="Heutige Security-Maßnahmen" icon={<Lock className="h-5 w-5 text-security-400" />}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">TLS 1.3</strong> erzwungen für alle Endpunkte (HSTS preload-ready geplant).</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Row-Level-Security (RLS)</strong> auf allen Mandanten-Tabellen — Default-Deny, explizite Policies.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Vault-basierte Secret-Storage</strong> — keine Secrets im Quellcode oder im Deployment-Env-Cleartext.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">SECURITY DEFINER Functions</strong> mit explizitem `search_path=public,pg_catalog` — verhindert Schema-Injection.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Audit-Trail über jeden KI-Call</strong> — Modell, Tenant, Bytes, Zeitstempel.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">DSGVO Art. 15/17 Selfservice</strong> — Datenexport + Account-Löschung im Dashboard.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">IP-Hash-Anonymisierung</strong> für Lead-Capture und Audit-Logs (kein IP-Cleartext-Storage).</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Rate-Limits</strong> auf öffentlichen Endpunkten (`audit`, `sales-lead`, `newsletter-subscribe`).</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">EU-Hosting</strong> in Frankfurt — keine US-Cloud-Default-Pfade, keine Drittland-Übermittlung außer auf expliziten Opt-In.</span></li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Sentry-Stub DSGVO-konform</strong> — `sendDefaultPii=false`, keine User-Kontext-Felder, EU-Region falls aktiviert.</span></li>
            </ul>
          </Section>

          <Section title="Offene Lücken (ehrlich)" icon={<AlertOctagon className="h-5 w-5 text-amber-400" />}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Kein Penetration-Test bisher.</strong> Erster externer Pentest geplant nach Erreichen 50 zahlende Kunden — Berichtsausschnitt wird auf dieser Seite veröffentlicht.</span></li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Keine SOC 2 / ISO 27001 Zertifizierung.</strong> SOC 2 Type 1 in Vorbereitung für 2026 Q4. ISO 27001 Audit-Vorbereitung läuft, Termin abhängig von Vorlauf-Audit.</span></li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Keine HSTS-Preload-Submission.</strong> HSTS aktiv, Preload-List-Submission geplant nach Apex-Domain-Stabilisierung.</span></li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Keine 2FA-Pflicht für User.</strong> Optional verfügbar (Supabase-MFA). Pflicht-Toggle pro Tenant geplant.</span></li>
              <li className="flex items-start gap-2"><Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" /><span><strong className="text-titanium-50">Keine WAF.</strong> Cloudflare-WAF-Layer als Hardening geplant für 2026 Q3.</span></li>
            </ul>
            <p className="text-xs text-titanium-500 mt-3">
              Wir publizieren Lücken offen, weil Compliance-Käufer unangenehme Wahrheit erkennen.
              Wer „100% sicher" verspricht, lügt oder weiß es nicht besser.
            </p>
          </Section>

          <Section title="Roadmap" icon={<FileCheck className="h-5 w-5 text-security-400" />}>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-start gap-2"><span className="text-emerald-400 font-mono text-xs mt-0.5">✓ 2026 Q2</span><span className="text-titanium-300">RLS-Hardening · SECURITY DEFINER search_path · Vault-Storage · Audit-Trail</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-400 font-mono text-xs mt-0.5">→ 2026 Q3</span><span className="text-titanium-300">Cloudflare WAF · HSTS Preload · 2FA-Pflicht-Toggle pro Tenant · Erster externer Pentest</span></li>
              <li className="flex items-start gap-2"><span className="text-titanium-500 font-mono text-xs mt-0.5">  2026 Q4</span><span className="text-titanium-400">SOC 2 Type 1 Audit · ISO 27001 Vorbereitung intensiv · Bug-Bounty-Programm öffentlich</span></li>
              <li className="flex items-start gap-2"><span className="text-titanium-500 font-mono text-xs mt-0.5">  2027 Q1-Q2</span><span className="text-titanium-400">SOC 2 Type 2 · ISO 27001 Zertifizierung · TÜV-Süd-Auditpfad für Behörden</span></li>
            </ul>
          </Section>

          <Section title="EU-Hosting · Sub-Processors" icon={<Server className="h-5 w-5 text-security-400" />}>
            <p>
              Alle produktiven Workloads laufen auf EU-Infrastruktur (Hetzner Frankfurt für Compute, Supabase EU-Frankfurt für Postgres + Edge Functions).
              Eine vollständige Liste der Sub-Processors mit Standort, Funktion und AVV-Status findest du unter
              {' '}<Link to="/legal/sub-processors" className="text-security-400 hover:text-security-300">/legal/sub-processors</Link>.
            </p>
            <p>
              KI-Modelle: Default sind EU-region-pinned API-Calls (Anthropic EU, OpenAI EU-Tenant, Google Vertex eu-central).
              Für höchste Souveränität ist Ollama-EU-local als Fallback verfügbar (Llama / Mistral, vollständig im eigenen Stack).
            </p>
          </Section>

          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-5 w-5 text-security-400" />
              <h2 className="font-display font-bold text-titanium-50 text-xl">Schwachstelle gefunden</h2>
            </div>
            <p className="text-titanium-300 text-sm mb-4">
              Vielen Dank für deine verantwortungsvolle Meldung. Wir antworten innerhalb von 72 Stunden.
              Bitte verzichte auf öffentliche Disclosure, bis wir gemeinsam ein Patch- und Veröffentlichungs-Datum vereinbart haben.
              Bug-Bounty-Programm ist für Q4/26 geplant.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to="/contact-sales?source=security-disclosure" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Schwachstelle melden <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/legal/sub-processors" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Sub-Processors ansehen
              </Link>
              <Link to="/legal/compliance-matrix" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                Compliance-Matrix
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Processors</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
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
