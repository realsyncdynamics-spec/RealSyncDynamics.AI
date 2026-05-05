import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, CheckCircle2, AlertTriangle, Loader2, Send,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface FormState {
  name: string;
  email: string;
  company: string;
  use_case: string;
  message: string;
}

export function ContactSales() {
  const [form, setForm] = useState<FormState>({
    name: '', email: '', company: '', use_case: '', message: '',
  });
  const [source, setSource] = useState('direct');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Capture source (utm_source / ?source / referrer) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('source') ?? params.get('utm_source');
    if (s) {
      setSource(s);
    } else if (document.referrer) {
      try {
        const ref = new URL(document.referrer);
        setSource(`ref:${ref.hostname}`);
      } catch { /* ignore */ }
    }
  }, []);

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/sales-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email: form.email.trim(),
          company: form.company.trim() || undefined,
          use_case: form.use_case || undefined,
          message: form.message.trim() || undefined,
          source,
          path: window.location.pathname,
        }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error?.message ?? `HTTP ${resp.status}`);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full bg-obsidian-900 border border-emerald-900 p-8 text-center rounded-none">
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="font-display text-2xl font-bold text-titanium-50 mb-2">Danke — wir melden uns.</h1>
          <p className="text-sm text-titanium-300 leading-relaxed mb-5">
            Innerhalb von 24 Stunden mit konkretem Termin-Vorschlag.
            Falls Du parallel die Architektur ansehen willst — alles ist
            transparent dokumentiert.
          </p>
          <div className="flex flex-col gap-2">
            <Link to="/legal/sub-processors"
              className="text-sm text-security-400 hover:underline">→ Sub-Prozessoren</Link>
            <Link to="/" className="text-sm text-security-400 hover:underline">→ Zurück zur Startseite</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <Mail className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Demo / Kontakt</div>
            <div className="text-[11px] text-titanium-400 font-medium">Antwort innerhalb 24h</div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-display text-3xl font-bold text-titanium-50 tracking-tight mb-2">
          Demo buchen
        </h1>
        <p className="text-sm text-titanium-400 leading-relaxed mb-8">
          30 Minuten, kein Pitch — wir gehen die für Dich relevanten Features
          live durch (eu_local-Modus, Audit-Log, n8n-Workflows, GDPR-Selfservice,
          Multi-Tenant-Setup).
        </p>

        {error && (
          <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="E-Mail" required>
            <input type="email" required value={form.email} onChange={handleChange('email')}
              placeholder="dein@firma.de" autoComplete="email"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
          </Field>

          <Field label="Name">
            <input type="text" value={form.name} onChange={handleChange('name')}
              placeholder="Vor- und Nachname" autoComplete="name"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
          </Field>

          <Field label="Firma / Kanzlei / Behörde">
            <input type="text" value={form.company} onChange={handleChange('company')}
              placeholder="z. B. Kanzlei Müller GmbH" autoComplete="organization"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500" />
          </Field>

          <Field label="Use-Case">
            <select value={form.use_case} onChange={handleChange('use_case')}
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500">
              <option value="">— bitte wählen —</option>
              <option value="compliance">DSGVO / Compliance / Audit-Pflicht</option>
              <option value="legal">Anwaltskanzlei / Mandantengeheimnis</option>
              <option value="health">HealthTech / Patientendaten</option>
              <option value="fintech">FinTech / BaFin</option>
              <option value="public">Behörde / öffentlicher Sektor</option>
              <option value="agency">Agentur / System-Integrator (White-Label)</option>
              <option value="other">Etwas anderes</option>
            </select>
          </Field>

          <Field label="Was sollen wir wissen? (optional)">
            <textarea value={form.message} onChange={handleChange('message')} rows={4}
              placeholder="Kurz: was wollt Ihr automatisieren oder absichern? Welcher Zeitrahmen? Etwa wieviele Endkunden / Dokumente / Anfragen?"
              className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-security-500 resize-y" />
          </Field>

          <button type="submit" disabled={loading || !form.email}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-none">
            {loading
              ? (<><Loader2 className="h-4 w-4 animate-spin" /> Senden…</>)
              : (<><Send className="h-4 w-4" /> Demo anfragen</>)}
          </button>

          <p className="text-[11px] text-titanium-500 text-center pt-2">
            Mit dem Absenden willigst Du in die Verarbeitung Deiner Anfrage gemäß unserer{' '}
            <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutzerklärung</Link> ein.
            Source-Tracking via UTM (kein Cookie nötig).
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
