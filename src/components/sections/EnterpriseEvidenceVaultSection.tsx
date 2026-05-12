import {
  Lock,
  Link2,
  KeyRound,
  Calendar,
  Download,
  ArrowRight,
} from 'lucide-react';

/**
 * EnterpriseEvidenceVaultSection — Public-Marketing fuer den
 * Aufsichtsbehoerden-tauglichen Evidence-Vault.
 *
 * Zeigt:
 *   1. 4 Trust-Pillars (Hash-Chain, HMAC-Sign, Retention, Export)
 *   2. Hash-Chain-Visualisierung (Event N -> Event N+1 mit prev_hash-Bond)
 *   3. Sample-Bundle als Code-Block (verkuerzte Variante des
 *      evidence-vault-export Outputs)
 */

const TRUST_PILLARS = [
  {
    icon: Link2,
    title: 'Hash-Chain (SHA-256)',
    detail:
      'Jedes Evidence-Event enthaelt event_hash + prev_hash. Manipulation an einem alten Event bricht die Kette ab dem Punkt — sofort verifizierbar.',
    tag: 'pgcrypto digest() · per-Tenant-Lock',
  },
  {
    icon: KeyRound,
    title: 'HMAC-Sign auf Export',
    detail:
      'Beim Bundle-Export wird pro Event signature = HMAC-SHA256(KEY, hash || chain_index) berechnet. Aufsichtsbehoerden koennen mit dem out-of-band-uebergebenen Key reproduzieren.',
    tag: 'algorithm: sha256-chain + hmac-sha256',
  },
  {
    icon: Calendar,
    title: 'Retention Policies',
    detail:
      'Pro Tenant: retention_days (Default 7 Jahre, EU-AI-Act-typisch) + hard_delete_after_days (Default 10). Helper-View ai_evidence_retention_status liefert pro Event den geplanten Loesch-Termin.',
    tag: 'AI Act Annex IV · DSGVO Art. 5 Abs. 1 lit. e',
  },
  {
    icon: Download,
    title: 'Aufsichtsbehoerden-Export',
    detail:
      'POST /functions/v1/evidence-vault-export liefert ein signiertes JSON-Bundle inkl. Verifier-Anleitung und Tip-Anchor. Datum-Range filterbar, optional pro AI-System.',
    tag: 'Edge-Function · Service-Role-Auth',
  },
];

const SAMPLE_BUNDLE = `{
  "ok": true,
  "bundle": {
    "tenant_id": "00000000-0000-0000-0000-0000000d3b7a",
    "exported_at": "2026-05-10T11:42:18Z",
    "range": { "from": "2026-04-10T00:00:00Z", "to": "2026-05-10T11:42:18Z" },
    "count": 3,
    "events": [
      {
        "id": "evt-001",
        "chain_index": 1,
        "event_type": "high_risk_detected",
        "event_summary": "HR Screening Assistant — High-Risk-Klassifikation",
        "risk_level": "critical",
        "created_at": "2026-04-10T08:30:00Z",
        "prev_hash": null,
        "event_hash": "9af1c0e2…3b4d",
        "signature":  "7f0e1ad9…8e62"
      },
      {
        "id": "evt-002",
        "chain_index": 2,
        "event_type": "runtime:prompt_sent",
        "event_summary": "openai/gpt-4.1 — Policy blockiert (PII zu external)",
        "risk_level": "high",
        "created_at": "2026-04-15T10:09:11Z",
        "prev_hash": "9af1c0e2…3b4d",
        "event_hash": "1e72af55…c0a1",
        "signature":  "ae3d4711…b21f"
      },
      {
        "id": "evt-003",
        "chain_index": 3,
        "event_type": "system_approved",
        "event_summary": "Marketing Content Agent — minimal-risk freigegeben",
        "risk_level": "low",
        "created_at": "2026-05-02T10:00:00Z",
        "prev_hash": "1e72af55…c0a1",
        "event_hash": "8b2f3c01…d774",
        "signature":  "fb19e8a5…05cc"
      }
    ],
    "tip": {
      "chain_index": 3,
      "event_hash": "8b2f3c01…d774",
      "signature":  "fb19e8a5…05cc"
    },
    "verifier": {
      "algorithm": "sha256-chain + hmac-sha256",
      "instructions": [
        "1. Iteriere events nach chain_index aufsteigend.",
        "2. event_hash neu berechnen, mit Feldwert vergleichen.",
        "3. prev_hash[i] === event_hash[i-1] (null fuer i=1).",
        "4. signature = HMAC-SHA256(KEY, event_hash + ':' + chain_index)."
      ]
    }
  }
}`;

export interface EnterpriseEvidenceVaultSectionProps {
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function EnterpriseEvidenceVaultSection({
  eyebrow = 'Enterprise Evidence Vault',
  headline = 'Aufsichtsbehörden-tauglicher Audit-Trail. Tamper-Evident, signiert, exportierbar.',
  subline = 'Hash-Chain auf jedem Evidence-Event, HMAC-Signatur beim Export, Retention-Policy pro Tenant. Wenn die Aufsichtsbehörde fragt: Sie liefern ein Bundle, der Auditor verifiziert es offline mit dem out-of-band-Key.',
}: EnterpriseEvidenceVaultSectionProps = {}) {
  return (
    <section
      id="enterprise-evidence-vault"
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

        {/* 4 Trust-Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-silver-700/30 mb-10">
          {TRUST_PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <article key={p.title} className="bg-obsidian-900/80 p-5 sm:p-6">
                <Icon className="h-5 w-5 text-gold-400 mb-3" />
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 leading-snug">
                  {p.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed mb-3">{p.detail}</p>
                <div className="font-mono text-[10px] uppercase tracking-wider text-silver-500 border-t border-silver-800/50 pt-2">
                  {p.tag}
                </div>
              </article>
            );
          })}
        </div>

        {/* Hash-Chain-Visualisierung */}
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-wider text-silver-300 mb-3">
            Hash-Chain — wie Tampering sichtbar wird
          </div>
          <div className="bg-obsidian-950 border border-silver-700/30 p-5 sm:p-6 overflow-x-auto">
            <div className="flex items-stretch gap-3 min-w-max">
              {[1, 2, 3].map((i, idx) => (
                <div key={i} className="flex items-stretch gap-3">
                  <div className="bg-obsidian-900 border border-silver-700/40 px-4 py-3 min-w-[180px]">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-silver-500 mb-1">
                      chain_index {i}
                    </div>
                    <div className="text-titanium-100 font-mono text-xs mb-2">
                      event {String(i).padStart(3, '0')}
                    </div>
                    <div className="text-[10px] font-mono text-silver-400">
                      prev:{' '}
                      <Lock className="inline h-2.5 w-2.5" />{' '}
                      <span className="text-silver-500">
                        {i === 1 ? 'null' : `${(i - 1) * 17}af…`}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-silver-400">
                      hash: <span className="text-gold-400">{i * 17}af…3b4d</span>
                    </div>
                    <div className="text-[10px] font-mono text-silver-400">
                      sig:{' '}
                      <span className="text-emerald-300">
                        {(i * 23).toString(16)}…b21f
                      </span>
                    </div>
                  </div>
                  {idx < 2 && (
                    <div className="flex items-center text-silver-500">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-silver-400 leading-relaxed">
              Jedes Event verweist via <code className="font-mono text-silver-300">prev_hash</code>
              {' '}auf den Hash seines Vorgaengers. Wer Event 1 manipuliert, bricht die Kette ab
              Event 2 — Aufsichtsbehoerden-Verifier erkennt das beim ersten Re-Hash.
            </p>
          </div>
        </div>

        {/* Sample-Bundle */}
        <div className="mb-10">
          <div className="text-[11px] font-mono uppercase tracking-wider text-silver-300 mb-3">
            Sample-Bundle (gekürzt)
          </div>
          <pre className="bg-obsidian-950 border border-silver-700/30 p-5 overflow-x-auto text-[11px] sm:text-xs font-mono text-silver-200 leading-relaxed">
            {SAMPLE_BUNDLE}
          </pre>
          <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
            POST /functions/v1/evidence-vault-export · Range filterbar · Pro AI-System filterbar
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/contact-sales?intent=evidence-vault"
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            DPA mit Signing-Key-Klausel anfordern <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="/legal/methodology"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            Methodik-Doku
          </a>
        </div>
      </div>
    </section>
  );
}
