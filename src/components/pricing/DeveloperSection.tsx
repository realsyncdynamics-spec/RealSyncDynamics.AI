import { Link } from 'react-router-dom';
import { ArrowRight, Code, Terminal, GitBranch, Webhook, FileJson, Boxes } from 'lucide-react';
import { minimumPlanForPermission, planById } from '@/shared/pricing';

/**
 * Developer Experience — REST API, SDKs, OpenAPI, Webhooks, CI/CD.
 *
 * Die Codebeispiele sind handgepflegt und spiegeln die öffentliche
 * Governance-API. Der Plan-Hinweis kommt aus der Pricing-SSoT, damit hier
 * kein zweiter Plan-Name gepflegt wird.
 */

const MIN_API_PLAN = minimumPlanForPermission('api');
const MIN_API_PLAN_NAME = MIN_API_PLAN ? planById(MIN_API_PLAN).name : 'Agency';

const SNIPPETS: Array<{ id: string; label: string; lang: string; code: string }> = [
  {
    id: 'rest',
    label: 'REST API',
    lang: 'bash',
    code: `curl -X POST https://api.realsyncdynamicsai.de/v1/scans \\
  -H "Authorization: Bearer $RSD_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"domain":"example.eu","policy_packs":["dsgvo","eu_ai_act"]}'`,
  },
  {
    id: 'ts',
    label: 'TypeScript SDK',
    lang: 'typescript',
    code: `import { RealSync } from '@realsync/sdk';

const rsd = new RealSync({ apiKey: process.env.RSD_API_KEY });

const scan = await rsd.scans.create({
  domain: 'example.eu',
  policyPacks: ['dsgvo', 'eu_ai_act'],
});

console.log(scan.governanceScore, scan.evidenceId);`,
  },
  {
    id: 'go',
    label: 'Go SDK',
    lang: 'go',
    code: `client := realsync.New(os.Getenv("RSD_API_KEY"))

scan, err := client.Scans.Create(ctx, &realsync.ScanInput{
    Domain:      "example.eu",
    PolicyPacks: []string{"dsgvo", "eu_ai_act"},
})
if err != nil {
    log.Fatal(err)
}
fmt.Println(scan.GovernanceScore, scan.EvidenceID)`,
  },
  {
    id: 'webhook',
    label: 'Webhooks',
    lang: 'json',
    code: `{
  "event": "governance.finding.created",
  "delivered_at": "2026-08-02T09:14:22Z",
  "signature": "sha256=…",
  "data": {
    "tenant_id": "…",
    "policy_pack": "eu_ai_act",
    "severity": "high",
    "evidence_id": "ev_…"
  }
}`,
  },
  {
    id: 'ci',
    label: 'GitHub Actions',
    lang: 'yaml',
    code: `- name: Governance Gate
  uses: realsyncdynamics/governance-action@v1
  with:
    api-key: \${{ secrets.RSD_API_KEY }}
    domain: example.eu
    fail-below-score: 70`,
  },
  {
    id: 'terraform',
    label: 'Terraform',
    lang: 'hcl',
    code: `resource "realsync_monitor" "prod" {
  domain       = "example.eu"
  policy_packs = ["dsgvo", "eu_ai_act", "iso_27001"]
  schedule     = "daily"

  alert {
    webhook_url = var.ops_webhook
    min_severity = "medium"
  }
}`,
  },
];

const CAPABILITIES = [
  { icon: Code, label: 'REST API', body: 'Versionierte Endpunkte für Scans, Nachweise, Risiken und Automationsläufe.' },
  { icon: Boxes, label: 'SDKs', body: 'TypeScript und Go, generiert aus derselben OpenAPI-Beschreibung.' },
  { icon: FileJson, label: 'OpenAPI', body: 'Vollständige Spezifikation als Vertrag zwischen Client und Runtime.' },
  { icon: Webhook, label: 'Webhooks', body: 'Signierte Ereignisse mit Wiederholung und Zustellprotokoll.' },
  { icon: GitBranch, label: 'CI/CD', body: 'Governance-Gate als Pflichtprüfung im Pull Request.' },
  { icon: Terminal, label: 'Terraform', body: 'Monitore, Policy Packs und Alarme als Infrastruktur-Code.' },
];

export function DeveloperSection() {
  return (
    <section
      className="border-t border-silver-700/30 px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      aria-labelledby="developer-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-titanium-500">
            Developer Experience
          </p>
          <h2
            id="developer-heading"
            className="mb-3 font-display text-2xl font-bold tracking-tight text-titanium-50 sm:text-3xl"
          >
            Governance als Teil Ihrer Pipeline
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-titanium-400">
            Die Runtime ist vollständig über die API steuerbar. Verfügbar ab dem
            Plan {MIN_API_PLAN_NAME}.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-px bg-titanium-900 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((cap) => (
            <div key={cap.label} className="bg-obsidian-950 p-5">
              <cap.icon className="mb-2 h-4 w-4 text-ai-cyan-400" aria-hidden="true" />
              <div className="mb-1 font-display text-sm font-bold text-titanium-50">{cap.label}</div>
              <p className="text-xs leading-relaxed text-titanium-400">{cap.body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SNIPPETS.map((snippet) => (
            <figure key={snippet.id} className="border border-titanium-800 bg-obsidian-950">
              <figcaption className="flex items-center justify-between border-b border-titanium-800 px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-titanium-400">
                  {snippet.label}
                </span>
                <span className="font-mono text-[10px] text-titanium-600">{snippet.lang}</span>
              </figcaption>
              <pre className="overflow-x-auto p-3">
                <code className="font-mono text-[11px] leading-relaxed text-titanium-300">
                  {snippet.code}
                </code>
              </pre>
            </figure>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/api-docs"
            className="inline-flex items-center gap-2 bg-ai-cyan-400 px-4 py-2 text-sm font-semibold text-obsidian-950 transition-colors hover:bg-ai-cyan-300"
          >
            API-Dokumentation <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/docs/governance"
            className="inline-flex items-center gap-2 border border-titanium-700 px-4 py-2 text-sm font-semibold text-titanium-200 transition-colors hover:border-titanium-500"
          >
            Governance-Handbuch
          </Link>
        </div>
      </div>
    </section>
  );
}
