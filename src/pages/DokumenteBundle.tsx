import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, FileText, Loader2, Download, Sparkles,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import type { DocMeta } from '../pdf';

/**
 * /dokumente-bundle — DSGVO-Doku-Generator (5 Templates).
 *
 * Public-Free-Tool. User füllt einmal die gemeinsamen Felder (Firma,
 * Adresse, Kontakt, Domain, optional DPO + Hosting) und kann dann
 * jedes Dokument einzeln als PDF herunterladen.
 *
 * @react-pdf/renderer wird lazy-loaded beim Klick auf einen Download-
 * Button — vermeidet ~150 kB Bundle-Bloat im Hauptchunk.
 *
 * Watermark-Footer: „Generiert von RealSyncDynamics.AI · Datum ·
 * Methodik 2026.05.0" steht auf jeder Seite jedes PDFs.
 */

type DocId = 'dse' | 'avv' | 'vvt' | 'tom' | 'dsfa';

interface DocSpec {
  id: DocId;
  name: string;
  norm: string;
  description: string;
  filename: (company: string) => string;
}

const DOCS: DocSpec[] = [
  {
    id: 'dse',
    name: 'Datenschutzerklärung',
    norm: 'Art. 13/14 DSGVO',
    description: 'Standard-DSE für Ihre Website mit Verantwortlichem, Cookies-Block, Betroffenenrechten.',
    filename: (c) => `Datenschutzerklaerung_${slug(c)}.pdf`,
  },
  {
    id: 'avv',
    name: 'AVV (Auftragsverarbeitung)',
    norm: 'Art. 28 DSGVO',
    description: 'Vertragsvorlage zwischen Auftraggeber und Auftragnehmer mit allen 28er-Pflichtklauseln.',
    filename: (c) => `AVV_${slug(c)}.pdf`,
  },
  {
    id: 'vvt',
    name: 'Verzeichnis Verarbeitungstätigkeiten',
    norm: 'Art. 30 DSGVO',
    description: 'VVT mit drei Standard-Tätigkeiten (Logfiles, Kontaktformular, Newsletter) als Grundgerüst.',
    filename: (c) => `VVT_${slug(c)}.pdf`,
  },
  {
    id: 'tom',
    name: 'TOM-Dokumentation',
    norm: 'Art. 32 DSGVO',
    description: '8 Standard-Maßnahmen-Kategorien: Vertraulichkeit, Integrität, Verfügbarkeit, Verfahren, Auftragskontrolle, Privacy by Design, Meldewesen, Awareness.',
    filename: (c) => `TOM_${slug(c)}.pdf`,
  },
  {
    id: 'dsfa',
    name: 'Datenschutz-Folgenabschätzung',
    norm: 'Art. 35 DSGVO',
    description: 'DSFA-Schablone mit den 4 Pflichtinhalten + AI-Act-Zusatzpunkten für KI-gestützte Verarbeitungen.',
    filename: (c) => `DSFA_${slug(c)}.pdf`,
  },
];

function slug(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'firma';
}

export function DokumenteBundle() {
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [domain, setDomain] = useState('');
  const [dpoName, setDpoName] = useState('');
  const [dpoEmail, setDpoEmail] = useState('');
  const [hostingProvider, setHostingProvider] = useState('');

  const [generating, setGenerating] = useState<DocId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<DocId>>(new Set());

  const formValid = company.trim() && address.trim() && contactEmail.trim();

  async function handleGenerate(docId: DocId) {
    if (!formValid) {
      setError('Bitte füllen Sie Firmenname, Anschrift und Kontakt-Email aus.');
      return;
    }
    setError(null);
    setGenerating(docId);
    try {
      const meta: DocMeta = {
        company: company.trim(),
        address: address.trim(),
        contactEmail: contactEmail.trim(),
        domain: domain.trim() || undefined,
        dpo: dpoName.trim() && dpoEmail.trim()
          ? { name: dpoName.trim(), email: dpoEmail.trim() }
          : undefined,
        hostingProvider: hostingProvider.trim() || undefined,
        generatedAt: new Date().toISOString(),
      };

      // Lazy-load @react-pdf/renderer + templates only on first download
      const [{ pdf }, templates] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../pdf'),
      ]);

      const docElement = (() => {
        switch (docId) {
          case 'dse':  return <templates.DSETemplate  meta={meta} />;
          case 'avv':  return <templates.AVVTemplate  meta={meta} />;
          case 'vvt':  return <templates.VVTTemplate  meta={meta} />;
          case 'tom':  return <templates.TOMTemplate  meta={meta} />;
          case 'dsfa': return <templates.DSFATemplate meta={meta} />;
        }
      })();

      const blob = await pdf(docElement).toBlob();

      const spec = DOCS.find((d) => d.id === docId)!;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = spec.filename(meta.company);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setGenerated((prev) => new Set(prev).add(docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF-Generierung fehlgeschlagen.');
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top-Bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50">
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Link>
        <Link
          to="/pricing"
          className="surface-gold inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Preise <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-8 sm:pt-14 sm:pb-12">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-7 flex flex-col items-center gap-3">
            <div className="logo-pulse">
              <Logo size={48} iconOnly />
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400">
              Doku-Bundle · Free
            </div>
          </div>

          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-4">
            DSGVO-Dokumente in 60 Sekunden generiert.
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Fünf Pflicht-Dokumente — DSE, AVV, VVT, TOM, DSFA — als sofort herunterladbare
            PDFs. Automatisch befüllt aus Ihren Firmendaten, mit Watermark-Footer und
            Methodik-Versionierung.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-obsidian-900/60 border border-silver-700/30 p-5 sm:p-7 rounded-none">
            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold-400 mb-4">
              Stammdaten · Pflicht
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Firmenname *">
                <input
                  required value={company} onChange={(e) => setCompany(e.target.value)}
                  placeholder="Müller GmbH"
                  className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
                />
              </Field>
              <Field label="Kontakt-Email *">
                <input
                  type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="datenschutz@firma.de"
                  className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
                />
              </Field>
            </div>

            <Field label="Anschrift (mehrzeilig erlaubt) *">
              <textarea
                required rows={2} value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Musterstraße 1, 10115 Berlin, Deutschland"
                className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
              />
            </Field>

            <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500 mt-5 mb-3">
              Optional · ergänzt Templates wo passend
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Domain">
                <input
                  value={domain} onChange={(e) => setDomain(e.target.value)}
                  placeholder="firma.de"
                  className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
                />
              </Field>
              <Field label="Hosting-Provider">
                <input
                  value={hostingProvider} onChange={(e) => setHostingProvider(e.target.value)}
                  placeholder="Hetzner Online GmbH"
                  className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="DSB-Name">
                <input
                  value={dpoName} onChange={(e) => setDpoName(e.target.value)}
                  placeholder="Anna Schmidt"
                  className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
                />
              </Field>
              <Field label="DSB-Email">
                <input
                  type="email" value={dpoEmail} onChange={(e) => setDpoEmail(e.target.value)}
                  placeholder="dsb@firma.de"
                  className="w-full bg-obsidian-950 border border-silver-700/40 px-3 py-2 text-sm rounded-none outline-none focus:border-gold-400 text-titanium-50"
                />
              </Field>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-800 rounded-none p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Doc-Cards */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12 sm:pb-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-gold-400 mb-3">
            5 PDFs zum Download
          </div>
          <div className="space-y-3">
            {DOCS.map((doc) => (
              <DocRow
                key={doc.id}
                doc={doc}
                generating={generating === doc.id}
                disabled={!formValid || (generating !== null && generating !== doc.id)}
                generated={generated.has(doc.id)}
                onGenerate={() => handleGenerate(doc.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-3xl mx-auto p-5 bg-obsidian-900/60 border border-silver-700/30 border-l-2 border-l-gold-400 rounded-none">
          <p className="text-sm text-silver-300 leading-relaxed">
            Dokumente werden automatisch aus Ihren Eingaben und unseren methodischen Vorlagen
            generiert. Die Vorlagen wurden methodisch durch unsere Partnerkanzlei geprüft.
            <strong className="text-titanium-200"> Kein Rechtsberatungsersatz.</strong>{' '}
            Insbesondere AVV und DSFA sind use-case-spezifisch und sollten von qualifiziertem
            Personal vor Unterschrift geprüft werden.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-silver-700/40 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-gold-400" />
            <span>© 2026 RealSync Dynamics · Made in Germany</span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/cookie-scanner"        className="hover:text-titanium-50 text-gold-400">Cookie-Scanner</Link>
            <Link to="/ai-act-workflows"      className="hover:text-titanium-50 text-gold-400">AI-Act Inventar</Link>
            <Link to="/pricing"               className="hover:text-titanium-50">Preise</Link>
            <Link to="/legal/privacy"         className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum"             className="hover:text-titanium-50">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver-400 mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}

function DocRow({
  doc, generating, disabled, generated, onGenerate,
}: {
  doc: DocSpec;
  generating: boolean;
  disabled: boolean;
  generated: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-4 sm:p-5 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FileText className="h-4 w-4 text-gold-400 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-display font-bold text-titanium-50 text-base">{doc.name}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-silver-400">{doc.norm}</span>
          </div>
          <p className="text-xs text-silver-300 leading-relaxed">{doc.description}</p>
        </div>
      </div>
      <button
        onClick={onGenerate} disabled={disabled || generating}
        className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-none transition-colors ${
          generated
            ? 'border border-emerald-700 bg-emerald-950/30 text-emerald-300'
            : 'surface-gold disabled:opacity-40'
        }`}
      >
        {generating
          ? (<><Loader2 className="h-4 w-4 animate-spin" /> Generiere …</>)
          : generated
            ? (<><CheckCircle2 className="h-4 w-4" /> Erneut</>)
            : (<><Download className="h-4 w-4" /> PDF</>)}
      </button>
    </div>
  );
}
