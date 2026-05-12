// Markdown-Export für AI-Act-Klassifikations-Ergebnisse.
//
// Erzeugt ein druck-/druckbares Compliance-Dokument (Markdown) aus dem
// Classifier-Result. Bewusst Markdown statt PDF: keine Edge-Function-
// Dependency, keine Storage, keine Auth — User klickt Download, fertig.
// PDF-Konvertierung kann jeder Editor (VSCode, Obsidian, Notion) machen.

import {
  REGISTRY,
  getCategory,
  getObligation,
  getPhase,
  obligationsByPhase,
  type AnnexIIIUseCase,
  type ObligationKey,
  type Severity,
} from './registry';

export interface ExportInput {
  system: string;
  severity: Severity;
  isMinimal: boolean;
  matchedUseCases: AnnexIIIUseCase[];
  prohibitedTriggers: { norm: string; rationale: string }[];
  limitedTriggers: { norm: string; rationale: string }[];
  obligations: ObligationKey[];
  confidence: number;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  prohibited: 'VERBOTEN (Art. 5)',
  high: 'HOHES RISIKO (Annex III)',
  limited: 'BEGRENZTES RISIKO (Art. 50)',
};

export function buildMarkdown(input: ExportInput): string {
  const date = new Date().toLocaleString('de-DE', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Berlin',
  });

  const sevLabel = input.isMinimal
    ? 'MINIMALES RISIKO'
    : SEVERITY_LABEL[input.severity];

  const lines: string[] = [];

  lines.push(`# EU-AI-Act Risikoklassifikation`);
  lines.push('');
  lines.push(`**System:** ${input.system || '(nicht angegeben)'}`);
  lines.push(`**Erstellt:** ${date}`);
  lines.push(`**Klassifikation:** ${sevLabel}`);
  lines.push(`**Konfidenz:** ${input.confidence}%`);
  lines.push(`**Registry-Version:** ${REGISTRY.version}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary box
  lines.push('## Zusammenfassung');
  lines.push('');
  if (input.isMinimal) {
    lines.push('Keine Annex-III-Use-Cases und keine Art-50-Transparenzpflichten getroffen.');
    lines.push('');
    lines.push('**Empfehlung:** Code-of-Conduct nach Art. 95 AI Act freiwillig adoptieren.');
  } else if (input.severity === 'prohibited') {
    lines.push('⚠️ **Mindestens ein Trigger fällt unter Art. 5 AI Act — vollständig verbotene Praktik.**');
    lines.push('');
    lines.push('Einsatz in EU untersagt. Sofortige juristische Beratung erforderlich.');
  } else if (input.severity === 'high') {
    lines.push(`Ihr System ist nach Annex III als **High-Risk** eingestuft. ${input.matchedUseCases.length} Use-Case${input.matchedUseCases.length === 1 ? '' : 's'} matched.`);
    lines.push('');
    lines.push('Conformity Assessment + Annex-IV-Dokumentation Pflicht vor Inverkehrbringen.');
  } else {
    lines.push('Ihr System unterliegt Transparenzpflichten nach Art. 50 AI Act.');
    lines.push('');
    lines.push('User müssen wissen dass sie mit KI interagieren bzw. Output ist als KI-generiert zu markieren.');
  }
  lines.push('');

  // Prohibited triggers
  if (input.prohibitedTriggers.length > 0) {
    lines.push('## Verbotene Praktiken (Art. 5)');
    lines.push('');
    for (const t of input.prohibitedTriggers) {
      lines.push(`- **${t.norm}** — ${t.rationale}`);
    }
    lines.push('');
  }

  // Matched use-cases
  if (input.matchedUseCases.length > 0) {
    lines.push(`## Annex-III Use-Cases (${input.matchedUseCases.length})`);
    lines.push('');
    for (const uc of input.matchedUseCases) {
      const cat = getCategory(uc.category);
      lines.push(`### ${uc.title}`);
      lines.push('');
      lines.push(`**Kategorie:** ${cat?.annex_section ?? uc.category} — ${cat?.label ?? ''}`);
      lines.push('');
      lines.push(uc.description);
      lines.push('');

      if (uc.examples_de && uc.examples_de.length > 0) {
        lines.push('**Beispiele:**');
        for (const ex of uc.examples_de) lines.push(`- ${ex}`);
        lines.push('');
      }

      if (uc.prohibited_overlay) {
        lines.push(`> ⚠️ **Art-5-Overlay:** ${uc.prohibited_overlay}`);
        lines.push('');
      }
      if (uc.carve_out) {
        lines.push(`> ✅ **Ausnahme:** ${uc.carve_out}`);
        lines.push('');
      }

      lines.push('**Normen-Referenzen:** ' + uc.norms.map((n) => `\`${n}\``).join(' · '));
      lines.push('');
    }
  }

  // Obligations roadmap
  if (input.obligations.length > 0) {
    lines.push(`## Compliance-Roadmap (${input.obligations.length} Pflichten)`);
    lines.push('');
    const grouped = obligationsByPhase(input.obligations);
    for (const [phase, items] of grouped.entries()) {
      const phaseMeta = getPhase(phase);
      lines.push(`### Phase ${phase}: ${phaseMeta?.label ?? ''}`);
      lines.push('');
      if (phaseMeta) {
        lines.push(`*${phaseMeta.description}*`);
        lines.push('');
      }
      lines.push('| Pflicht | Norm | Aufwand | Geschätzt |');
      lines.push('|---|---|---|---|');
      for (const { meta } of items) {
        const effort = meta.effort === 'high' ? 'Hoch' : meta.effort === 'medium' ? 'Mittel' : 'Niedrig';
        lines.push(`| ${meta.label} | \`${meta.ai_act_article}\` | ${effort} | ${meta.estimated_days} Tage |`);
      }
      lines.push('');
      // Detail-Beschreibungen
      for (const { meta } of items) {
        lines.push(`**${meta.label}** — ${meta.description}`);
        lines.push('');
      }
    }
  }

  // Limited-risk triggers
  if (input.limitedTriggers.length > 0) {
    lines.push('## Transparenz-Pflichten (Art. 50)');
    lines.push('');
    for (const t of input.limitedTriggers) {
      lines.push(`- **${t.norm}** — ${t.rationale}`);
    }
    lines.push('');
  }

  // Disclaimer
  lines.push('---');
  lines.push('');
  lines.push('## Rechtlicher Hinweis');
  lines.push('');
  lines.push('Dieses Dokument ist eine **technische Klassifikations-Hilfe** auf Basis der EU-AI-Act-Verordnung 2024/1689 (Annex III + Art. 5/50/53).');
  lines.push('Es ersetzt **keine individuelle Rechtsberatung**. Für verbindliche Aussagen konsultieren Sie eine auf KI-Compliance spezialisierte Kanzlei oder Ihren Datenschutzbeauftragten.');
  lines.push('');
  lines.push(`Generiert mit RealSyncDynamics.AI — Annex-III-Registry v${REGISTRY.version}.`);
  lines.push('');

  return lines.join('\n');
}

export function downloadMarkdown(input: ExportInput) {
  const md = buildMarkdown(input);
  const date = new Date().toISOString().split('T')[0];
  const slug = (input.system || 'ai-system').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ai-system';
  const filename = `ai-act-classification_${slug}_${date}.md`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
