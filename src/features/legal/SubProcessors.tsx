import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface SubProcessor {
  name: string;
  purpose: string;
  data_categories: string[];
  region: string;
  dpa_url: string;
  status: 'signed' | 'available' | 'pending';
}

const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: 'Supabase Inc.',
    purpose: 'Auth, Postgres-Datenbank, Edge Functions, Storage',
    data_categories: ['Account-Daten', 'Profile', 'Workflows', 'Audit-Logs', 'Asset-Metadaten'],
    region: 'Frankfurt (eu-central-1, AWS)',
    dpa_url: 'https://supabase.com/legal/dpa',
    status: 'available',
  },
  {
    name: 'Anthropic, PBC',
    purpose: 'AI-Inferenz (Cloud-Pfad, Modelle Claude Sonnet 4.6 / Opus 4.7)',
    data_categories: ['User-Eingaben in AI-Tools (Prompt + Kontext)'],
    region: 'USA (mit EU-DPA + SCCs)',
    dpa_url: 'https://www.anthropic.com/legal/dpa',
    status: 'available',
  },
  {
    name: 'Google LLC',
    purpose: 'AI-Inferenz (Cloud-Pfad, Gemini-Modelle)',
    data_categories: ['User-Eingaben in AI-Tools (Prompt + Kontext)'],
    region: 'USA (mit EU-DPA + SCCs)',
    dpa_url: 'https://cloud.google.com/terms/data-processing-addendum',
    status: 'available',
  },
  {
    name: 'OpenAI, L.L.C.',
    purpose: 'AI-Inferenz (Cloud-Pfad, GPT-Modelle, optional)',
    data_categories: ['User-Eingaben in AI-Tools (Prompt + Kontext)'],
    region: 'USA (mit EU-DPA + SCCs)',
    dpa_url: 'https://openai.com/policies/data-processing-addendum',
    status: 'available',
  },
  {
    name: 'Stripe Payments Europe, Limited',
    purpose: 'Zahlungsabwicklung (Subscriptions, Invoicing)',
    data_categories: ['Email', 'Name', 'Zahlungsdaten (von Stripe selbst gehostet)'],
    region: 'Irland (EU)',
    dpa_url: 'https://stripe.com/legal/dpa',
    status: 'available',
  },
  {
    name: 'Hostinger International, Ltd.',
    purpose: 'VPS-Hosting für EU-lokal-Stack (Ollama, n8n, Open WebUI) + AI Gateway Inference Runtime (LM Studio, OpenAI-kompatibel) hinter unserem Supabase-Edge-Gateway',
    data_categories: ['User-Eingaben bei eu_local-Modus', 'AI-Prompt + Kontext (AI Gateway, fast-local / quality-local / strict-json Profile)', 'AI-Output', 'Workflow-Daten'],
    region: 'Frankfurt (Deutschland)',
    dpa_url: 'https://www.hostinger.com/legal/data-processing-agreement',
    status: 'available',
  },
  {
    name: 'Resend Inc.',
    purpose: 'Transaktionale Emails (Audit-Reports, Welcome-Emails, System-Notifications)',
    data_categories: ['Email-Adresse des Empfängers', 'Email-Inhalt'],
    region: 'EU (Ireland) — Versand-Endpoint, Storage in EU',
    dpa_url: 'https://resend.com/legal/dpa',
    status: 'available',
  },
  {
    name: 'GitHub, Inc. (Microsoft Corporation)',
    purpose: 'Statisches Frontend-Hosting via GitHub Pages CDN, Repository-Hosting',
    data_categories: ['IP-Adresse + User-Agent (HTTP-Logs, kein PII-Storage)'],
    region: 'Global CDN (Edge), USA (mit EU-DPA + SCCs)',
    dpa_url: 'https://github.com/customer-terms/github-data-protection-agreement',
    status: 'available',
  },
];

export function SubProcessors() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Sub-Prozessoren</div>
            <div className="text-[11px] text-titanium-400 font-medium">DSGVO Art. 28 Transparenz</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="prose prose-invert max-w-none text-titanium-300 text-sm leading-relaxed">
          <p>
            Diese Liste dokumentiert alle Auftragsverarbeiter (Art. 28 DSGVO), die wir
            zur Bereitstellung von <strong>RealSyncDynamics.AI</strong> einsetzen. Jeder
            dieser Anbieter verarbeitet personenbezogene Daten nur auf unsere Weisung
            und unter einer Vereinbarung zur Auftragsverarbeitung (AVV / DPA).
          </p>
          <p>
            Wenn Du als Workspace-Owner / Tenant-Admin den Modus „EU-lokal" in
            <Link to="/settings/ai-residency" className="text-security-400"> /settings/ai-residency </Link>
            aktivierst, werden AI-Anfragen ausschließlich auf unserem Hostinger-VPS in
            Deutschland verarbeitet — Anthropic / Google / OpenAI werden dann <strong>
            nicht</strong> kontaktiert.
          </p>
          <p className="text-[11px] text-titanium-500">
            Stand: {new Date().toISOString().slice(0, 10)} · Änderungen werden hier
            laufend dokumentiert. Wesentliche Änderungen werden Workspace-Ownern per
            Email avisiert (Art. 28 Abs. 2 DSGVO).
          </p>
        </div>

        <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5">Anbieter</th>
                <th className="text-left px-3 py-2.5 hidden md:table-cell">Zweck</th>
                <th className="text-left px-3 py-2.5 hidden lg:table-cell">Region</th>
                <th className="text-center px-3 py-2.5">AVV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-titanium-900">
              {SUB_PROCESSORS.map((p) => (
                <tr key={p.name} className="hover:bg-obsidian-950">
                  <td className="px-3 py-3 align-top">
                    <div className="font-display font-bold text-titanium-50">{p.name}</div>
                    <div className="text-[11px] text-titanium-500 mt-0.5">
                      {p.data_categories.join(' · ')}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-titanium-300 hidden md:table-cell text-xs">{p.purpose}</td>
                  <td className="px-3 py-3 text-titanium-300 hidden lg:table-cell text-xs">{p.region}</td>
                  <td className="px-3 py-3 text-center">
                    <a href={p.dpa_url} target="_blank" rel="noreferrer noopener"
                       className="inline-flex items-center gap-1 text-security-400 hover:underline text-xs">
                      DPA <ExternalLink className="h-3 w-3" />
                    </a>
                    <div className="mt-1">
                      {p.status === 'signed'
                        ? <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="h-3 w-3" /> signed</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] text-amber-400"><AlertCircle className="h-3 w-3" /> available</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SubProcessorSubscribeForm />

        <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 pt-4 border-t border-titanium-900">
          <Link to="/legal/privacy" className="hover:text-titanium-200">Datenschutzerklärung</Link>
          <Link to="/settings/account" className="hover:text-titanium-200">Mein Account · Datenexport / Löschung</Link>
          <a href="mailto:privacy@realsyncdynamicsai.de" className="hover:text-titanium-200">Anfragen Datenschutz</a>
        </div>
      </main>
    </div>
  );
}

function SubProcessorSubscribeForm() {
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = React.useState('');

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('submitting');
    setErrorMsg('');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      // Fallback: mailto
      window.location.href = `mailto:hello@realsyncdynamicsai.de?subject=Sub-Processor-Notifications%20abonnieren&body=Email%3A%20${encodeURIComponent(email)}%0AFirma%3A%20${encodeURIComponent(company)}`;
      setStatus('success');
      return;
    }

    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/sub_processor_subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), company: company.trim() || null }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  if (status === 'success') {
    return (
      <div className="mt-6 p-4 bg-emerald-950/20 border border-emerald-800 rounded-none">
        <div className="text-emerald-300 font-bold text-sm mb-1">Eingetragen.</div>
        <div className="text-xs text-titanium-300">
          Wir senden dir 30 Tage vor jeder Sub-Processor-Änderung eine Notification per E-Mail. Widersprochenes
          ist via Antwort-Mail oder Unsubscribe-Link möglich.
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 p-4 bg-obsidian-900 border border-titanium-900 rounded-none"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-1">
        Art. 28 Abs. 2 DSGVO · 30-Tage-Vorab-Notice
      </div>
      <div className="font-display font-bold text-titanium-50 text-sm mb-3">
        Sub-Processor-Änderungen abonnieren
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mb-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vorname.name@firma.de"
          className="bg-obsidian-950 border border-titanium-800 text-titanium-100 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none"
        />
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Firma (optional)"
          className="bg-obsidian-950 border border-titanium-800 text-titanium-100 px-3 py-2 text-sm rounded-none focus:border-security-500 outline-none"
        />
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="submit"
          disabled={status === 'submitting' || !email}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-security-500 hover:bg-security-600 disabled:bg-titanium-800 disabled:text-titanium-600 disabled:cursor-not-allowed text-white text-xs font-bold rounded-none"
        >
          {status === 'submitting' ? 'Sende …' : 'Abonnieren'}
        </button>
        {status === 'error' && (
          <span className="text-xs text-red-300">Fehler: {errorMsg}</span>
        )}
      </div>
      <p className="text-[10px] text-titanium-500 mt-3 leading-relaxed">
        Wir verarbeiten E-Mail + optional Firma zur Erfüllung der Notification-Pflicht (Art. 28 Abs. 2).
        Rechtsgrundlage: Art. 6 Abs. 1 lit. b/c. Abbestellen jederzeit per Link in der Mail oder Antwort.
      </p>
    </form>
  );
}
