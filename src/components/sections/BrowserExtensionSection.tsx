import {
  Globe,
  AlertTriangle,
  FileUp,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';

/**
 * BrowserExtensionSection — Public-Marketing-Section fuer den AI Usage Monitor.
 *
 * Eingebettet auf /ai-governance unter den beiden Dashboards. Zeigt die 5
 * unterstuetzten Vendoren, was erkannt wird und eine Beta-Hinweis-Box mit
 * Install-Link.
 *
 * Quelle der Faktenliste: extension-ai-monitor/README.md
 */

const VENDORS = [
  { name: 'ChatGPT', host: 'chatgpt.com' },
  { name: 'Claude', host: 'claude.ai' },
  { name: 'Microsoft Copilot', host: 'copilot.microsoft.com' },
  { name: 'Gemini', host: 'gemini.google.com' },
  { name: 'Perplexity', host: 'perplexity.ai' },
];

const DETECTIONS = [
  {
    icon: Globe,
    title: 'Session-Start pro Tab',
    detail:
      'Sobald ein Mitarbeiter eine Vendor-URL oeffnet, landet ein session_start-Event im Vault — Vendor, Modell (best-effort), Tab-Origin.',
  },
  {
    icon: AlertTriangle,
    title: 'Prompt-Submit-Detection',
    detail:
      'Bei jedem Enter im Composer: Token-Schaetzung, PII-Heuristik (Email / Phone / IBAN / Steuer-ID / Geburtsdatum) und Risk-Level — Prompt-Text wird NICHT gesendet.',
  },
  {
    icon: FileUp,
    title: 'File-Upload-Tracking',
    detail:
      'Jedes <input type=file>-Change-Event landet als file_upload-Event mit File-Anzahl, Total-Size und Datei-Endungen — kein Inhalt.',
  },
];

export interface BrowserExtensionSectionProps {
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function BrowserExtensionSection({
  eyebrow = 'Browser Extension · Shadow-AI-Detection',
  headline = 'Erkennt was Mitarbeiter mit AI-Tools im Browser tatsächlich machen.',
  subline = 'Chrome/Edge/Brave-Extension auf MV3-Basis. Loggt AI-Sessions, Prompts (nur Metadaten) und File-Uploads für 5 Vendoren ans RealSyncDynamicsAI Compliance-OS — log-only in v0, kein Blocking.',
}: BrowserExtensionSectionProps = {}) {
  return (
    <section
      id="browser-extension"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl">
            {headline}
          </h2>
          <p className="mt-4 max-w-3xl text-silver-300 text-sm sm:text-base leading-relaxed">
            {subline}
          </p>
        </div>

        {/* Unterstuetzte Vendoren */}
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-wider text-silver-300 mb-3">
            Unterstützte Vendoren
          </div>
          <div className="flex flex-wrap gap-2">
            {VENDORS.map((v) => (
              <span
                key={v.name}
                className="inline-flex items-center gap-2 px-3 py-2 bg-obsidian-900/60 border border-silver-700/30 text-titanium-100 text-sm"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-gold-400">
                  ✓
                </span>
                <span className="font-display font-bold">{v.name}</span>
                <span className="font-mono text-[10px] text-silver-500">{v.host}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Was wird erkannt */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-silver-700/30 mb-10">
          {DETECTIONS.map((d) => {
            const Icon = d.icon;
            return (
              <article key={d.title} className="bg-obsidian-900 p-5 sm:p-6">
                <Icon className="h-5 w-5 text-gold-400 mb-3" />
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 leading-snug">
                  {d.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{d.detail}</p>
              </article>
            );
          })}
        </div>

        {/* Privacy-Note */}
        <div className="bg-obsidian-900/60 border-l-2 border-l-emerald-400/70 border border-silver-700/30 p-5 sm:p-6 mb-10">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-display font-bold text-titanium-50 text-sm sm:text-base mb-1">
                Privacy-Default: Presence statt Content
              </div>
              <p className="text-sm text-silver-300 leading-relaxed">
                Die Extension sendet niemals den Prompt-Text. Nur strukturierte Metadaten
                (Vendor, Token-Schaetzung, PII-Hit-Typen, Risk-Level) landen am Telemetry-
                Endpoint. Konfig liegt ausschliesslich in <code className="font-mono text-xs text-titanium-200">chrome.storage.local</code>
                {' '}— kein Cloud-Sync, kein Cloud-Backup.
              </p>
            </div>
          </div>
        </div>

        {/* Beta-CTA */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/tree/main/extension-ai-monitor"
            target="_blank"
            rel="noreferrer noopener"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            Extension installieren (Unpacked / Beta) <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/contact-sales?intent=browser-extension"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            Enterprise-Rollout anfragen
          </a>
        </div>

        <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          MV3-Manifest · Pure-JS · kein Build-Step · Chrome / Edge / Brave kompatibel
        </p>
      </div>
    </section>
  );
}
