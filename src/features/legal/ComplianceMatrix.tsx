import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, ArrowRight, Printer } from 'lucide-react';

type Cell = 'yes' | 'no' | 'partial' | string;

interface Row {
  category: string;
  dimension: string;
  paragraph?: string;
  openai: Cell;
  anthropic: Cell;
  google: Cell;
  realsync: Cell;
  note?: string;
}

const ROWS: Row[] = [
  // Datenresidenz
  { category: 'Datenresidenz', dimension: 'EU-Server erzwingbar', paragraph: 'DSGVO Art. 44',
    openai: 'no', anthropic: 'no', google: 'partial',
    realsync: 'yes',
    note: 'OpenAI / Anthropic: US-only. Google: EU optional auf Vertex, aber nicht Default.' },
  { category: 'Datenresidenz', dimension: 'Schrems-II-konform ohne Zusatzmaßnahmen',
    openai: 'no', anthropic: 'no', google: 'partial', realsync: 'yes',
    note: 'eu_local-Modus läuft auf Hostinger-EU-Server, kein Drittlandtransfer.' },

  // AVV / Vertragsgrundlagen
  { category: 'Verträge', dimension: 'AVV / DPA verfügbar', paragraph: 'DSGVO Art. 28',
    openai: 'partial', anthropic: 'partial', google: 'yes', realsync: 'yes',
    note: 'OpenAI / Anthropic AVV decken Schrems-II nur unzureichend (US-LawCloud Act).' },
  { category: 'Verträge', dimension: 'Sub-Prozessoren öffentlich gelistet',
    openai: 'partial', anthropic: 'partial', google: 'yes', realsync: 'yes' },
  { category: 'Verträge', dimension: 'Vertragssprache Deutsch + Gerichtsstand DE',
    openai: 'no', anthropic: 'no', google: 'no', realsync: 'yes' },

  // Audit / Logging
  { category: 'Audit-Trail', dimension: 'Audit-Log pro AI-Aufruf',
    openai: 'no', anthropic: 'no', google: 'partial', realsync: 'yes',
    note: 'Direkt-Provider liefern nur Account-Logs, kein Per-Call-Detail.' },
  { category: 'Audit-Trail', dimension: 'Pro-Call: User, Modell, Tokens, Kosten, Residenz',
    openai: 'no', anthropic: 'no', google: 'no', realsync: 'yes' },
  { category: 'Audit-Trail', dimension: 'CSV/PDF-Export für Auditor',
    openai: 'no', anthropic: 'no', google: 'partial', realsync: 'yes' },

  // DSGVO Selfservice
  { category: 'DSGVO-Rechte', dimension: 'Auskunft Art. 15 als API', paragraph: 'DSGVO Art. 15',
    openai: 'no', anthropic: 'no', google: 'no', realsync: 'yes' },
  { category: 'DSGVO-Rechte', dimension: 'Löschung Art. 17 als API', paragraph: 'DSGVO Art. 17',
    openai: 'no', anthropic: 'no', google: 'no', realsync: 'yes' },
  { category: 'DSGVO-Rechte', dimension: 'Datenportabilität Art. 20', paragraph: 'DSGVO Art. 20',
    openai: 'partial', anthropic: 'no', google: 'partial', realsync: 'yes' },

  // Multi-Tenant / Isolation
  { category: 'Mandanten-Isolation', dimension: 'Multi-Tenant mit RLS',
    openai: 'no', anthropic: 'no', google: 'no', realsync: 'yes' },
  { category: 'Mandanten-Isolation', dimension: 'Pro-Tenant Daten-Hoheit',
    openai: 'no', anthropic: 'no', google: 'partial', realsync: 'yes' },

  // Branchen-Spezifika
  { category: 'Branchen-Compliance', dimension: '§ 203 StGB Mandantengeheimnis (Anwälte)',
    openai: 'no', anthropic: 'no', google: 'no', realsync: 'yes',
    note: 'Strikte EU-Local-Verarbeitung erforderlich.' },
  { category: 'Branchen-Compliance', dimension: 'BAIT / MaRisk (Finanzaufsicht)',
    openai: 'no', anthropic: 'no', google: 'partial', realsync: 'partial',
    note: 'RealSync erfüllt technische Anforderungen, BaFin-Anzeige bleibt beim Kunden.' },
  { category: 'Branchen-Compliance', dimension: 'BSI IT-Grundschutz (Behörden)',
    openai: 'no', anthropic: 'no', google: 'partial', realsync: 'partial',
    note: 'Vorbereitung in EU-local-Mode möglich, BSI-Zertifikat noch nicht erteilt.' },

  // Pricing / Eintrittsbarriere
  { category: 'Wirtschaftlichkeit', dimension: 'Setup-Fee',
    openai: '0 €', anthropic: '0 €', google: '0 €', realsync: '0 €' },
  { category: 'Wirtschaftlichkeit', dimension: 'Compliance-Aufwand intern',
    openai: '40-160 PT', anthropic: '40-160 PT', google: '20-80 PT', realsync: '5-15 PT',
    note: 'OpenAI direkt = Sie bauen AVV, Audit-Log, Selfservice selbst. RealSync = enthalten.' },
];

export function ComplianceMatrix() {
  const grouped = groupBy(ROWS, (r) => r.category);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 print:hidden">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Compliance-Matrix</div>
            <div className="text-[11px] text-titanium-400 font-medium">DSGVO · AI Act · Branchen-Recht</div>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
        >
          <Printer className="h-3.5 w-3.5" /> Drucken / als PDF speichern
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 print:py-0 print:px-0 print:max-w-none">

        <div className="text-center mb-10 print:text-left print:mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-4 print:hidden">
            <ShieldCheck className="h-3 w-3" /> Vergleichstabelle · Stand 2026
          </div>
          <h1 className="text-3xl sm:text-4xl print:text-2xl font-display font-bold text-titanium-50 tracking-tight mb-3">
            DSGVO &amp; AI-Compliance — Anbieter im Vergleich
          </h1>
          <p className="text-titanium-300 max-w-2xl mx-auto print:max-w-none">
            18 Kriterien gegen 4 Anbieter. Wenn Du AI-Provider direkt nutzt, bleibst Du allein verantwortlich für AVV, Audit-Log und DSGVO-Selfservice.
          </p>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse text-sm print:text-xs">
            <thead className="sticky top-14 bg-obsidian-950 print:static print:bg-titanium-100">
              <tr className="border-b-2 border-titanium-700 print:border-[#1a1f2b]">
                <th className="text-left py-3 px-3 font-display font-bold text-titanium-50 print:text-[#0d1117] w-[40%]">Kriterium</th>
                <th className="text-center py-3 px-3 font-bold text-titanium-300 print:text-[#2c3340]">OpenAI<br /><span className="text-[10px] text-titanium-500 print:text-[#7a838e] font-normal">direkt</span></th>
                <th className="text-center py-3 px-3 font-bold text-titanium-300 print:text-[#2c3340]">Anthropic<br /><span className="text-[10px] text-titanium-500 print:text-[#7a838e] font-normal">direkt</span></th>
                <th className="text-center py-3 px-3 font-bold text-titanium-300 print:text-[#2c3340]">Google<br /><span className="text-[10px] text-titanium-500 print:text-[#7a838e] font-normal">Vertex AI</span></th>
                <th className="text-center py-3 px-3 font-bold text-security-300 print:text-[#1f6feb] bg-security-950/20 print:bg-[#f0f7ff]">RealSync<br /><span className="text-[10px] text-security-400 print:text-[#1f6feb] font-normal">Dynamics</span></th>
              </tr>
            </thead>
            {Object.entries(grouped).map(([cat, rows]) => (
              <tbody key={cat}>
                <tr>
                  <td colSpan={5} className="bg-obsidian-900 print:bg-titanium-200 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.15em] text-titanium-500 print:text-[#5a6470]">
                    {cat}
                  </td>
                </tr>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b border-titanium-900 print:border-titanium-300 align-top">
                    <td className="py-3 px-3">
                      <div className="text-titanium-200 print:text-[#1a1f2b]">{r.dimension}</div>
                      {r.paragraph && (
                        <div className="text-[10px] text-titanium-500 print:text-[#7a838e] font-mono mt-0.5">{r.paragraph}</div>
                      )}
                      {r.note && (
                        <div className="text-[11px] text-titanium-500 print:text-[#5a6470] mt-1.5 leading-snug">{r.note}</div>
                      )}
                    </td>
                    <Td value={r.openai} />
                    <Td value={r.anthropic} />
                    <Td value={r.google} />
                    <Td value={r.realsync} highlight />
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>

        <div className="mt-10 p-5 bg-obsidian-900 border border-titanium-900 print:bg-titanium-100 print:border-titanium-300 print:text-[#1a1f2b]">
          <h3 className="font-display font-bold text-titanium-50 print:text-[#0d1117] mb-2">Wie Du diese Tabelle liest</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400 print:text-[#2f855a] mt-0.5 shrink-0" /><span><strong>Ja</strong> — Anforderung erfüllt out-of-the-box.</span></div>
            <div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-amber-400 print:text-[#d97706] mt-0.5 shrink-0" /><span><strong>Teilweise</strong> — funktioniert mit Einschränkungen / Zusatzaufwand.</span></div>
            <div className="flex items-start gap-2"><XCircle className="h-4 w-4 text-red-400 print:text-[#c53030] mt-0.5 shrink-0" /><span><strong>Nein</strong> — nicht abgedeckt, Du musst es selbst bauen.</span></div>
          </div>
        </div>

        <div className="mt-8 text-xs text-titanium-500 print:text-[#7a838e] leading-relaxed">
          <strong>Quellen:</strong> EuGH Schrems-II-Urteil (C-311/18, 16.07.2020) · BfDI Positionsbestimmung KI &amp; Datenschutz (2024) · EDSA Guidelines 03/2022 (Dark Patterns) · BSI Grundschutz-Kompendium · BaFin Rundschreiben 10/2021 (MaRisk) · Sub-Prozessoren-Status laut jeweils öffentlichen DPAs (Stand Mai 2026). Die Tabelle erhebt keinen Anspruch auf juristische Vollständigkeit; im konkreten Mandat ist Einzelberatung erforderlich.
        </div>

        <div className="mt-10 print:hidden flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/contact-sales?source=compliance_matrix"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none">
            Founding Access starten <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/legal/avv"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-obsidian-900 border border-titanium-700 hover:bg-obsidian-800 text-titanium-200 font-semibold rounded-none">
            AVV-Template ansehen
          </Link>
        </div>
      </main>

      <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-8 print:hidden">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between gap-3 text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV-Template</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Td({ value, highlight }: { value: Cell; highlight?: boolean }) {
  if (value === 'yes') {
    return (
      <td className={`text-center py-3 px-3 ${highlight ? 'bg-security-950/20 print:bg-[#f0f7ff]' : ''}`}>
        <CheckCircle2 className="h-5 w-5 inline-block text-emerald-400 print:text-[#2f855a]" />
      </td>
    );
  }
  if (value === 'no') {
    return (
      <td className={`text-center py-3 px-3 ${highlight ? 'bg-security-950/20 print:bg-[#f0f7ff]' : ''}`}>
        <XCircle className="h-5 w-5 inline-block text-red-400 print:text-[#c53030]" />
      </td>
    );
  }
  if (value === 'partial') {
    return (
      <td className={`text-center py-3 px-3 ${highlight ? 'bg-security-950/20 print:bg-[#f0f7ff]' : ''}`}>
        <AlertTriangle className="h-5 w-5 inline-block text-amber-400 print:text-[#d97706]" />
      </td>
    );
  }
  return (
    <td className={`text-center py-3 px-3 text-titanium-300 print:text-[#1a1f2b] text-xs font-mono ${highlight ? 'bg-security-950/20 print:bg-[#f0f7ff]' : ''}`}>
      {value}
    </td>
  );
}

function groupBy<T, K extends string>(arr: T[], fn: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = fn(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
