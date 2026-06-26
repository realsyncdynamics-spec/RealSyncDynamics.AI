/**
 * Annex-IV-Konformitätsdossier — Assembler + Markdown-Renderer.
 *
 * Baut aus den vorhandenen Governance-Modulen (KI-System-Registry, Art-10-
 * Datensätze, Evidence, Pflichten-Roadmap, Human Oversight) ein technisches
 * Dokumentationspaket nach Annex IV Verordnung 2024/1689. Fehlende Bausteine
 * werden je Abschnitt als „Lücke" markiert, statt sie zu verschweigen — das
 * Dossier ist damit zugleich eine Vollständigkeits-Checkliste.
 *
 * Bewusst rein (keine I/O), damit testbar; Download-Helper am Ende.
 */

export interface DossierSystem {
  name: string;
  provider?: string | null;
  model?: string | null;
  riskLabel: string;              // z.B. "Hoch" / "Begrenzt"
  annexCategory?: string | null;  // menschenlesbares Label
  providerRole?: string | null;   // menschenlesbares Label
  intendedPurpose?: string | null;
  deploymentContext?: string | null;
  affectedGroups?: string[];
  scope?: string | null;
  owner?: string | null;
}

export interface DossierDataset {
  name: string;
  role: string;
  containsPersonalData: boolean;
  legalBasis?: string | null;
  biasAssessment?: string | null;
}

export interface DossierEvidence {
  title: string;
  hash?: string | null;
  ts?: string | null;
}

export interface DossierObligation {
  label: string;
  article: string;
  done: boolean;
}

export interface DossierInput {
  system: DossierSystem;
  datasets?: DossierDataset[];
  evidence?: DossierEvidence[];
  obligations?: DossierObligation[];
  oversight?: string | null;
  harmonisedStandards?: string[];
  changeLog?: string[];
  registryVersion?: string;
}

export interface DossierSection {
  num: number;
  title: string;
  article: string;
  lines: string[];
  /** Fehlende Pflicht-Bausteine dieses Abschnitts. */
  gaps: string[];
}

export interface ConformityDossier {
  system: string;
  sections: DossierSection[];
  /** Erfüllungsgrad 0–100 über alle Abschnitte (1 − Lücken/Abschnitte). */
  completeness: number;
}

const hasText = (v: string | null | undefined): boolean =>
  typeof v === 'string' && v.trim().length > 0;

export function buildConformityDossier(input: DossierInput): ConformityDossier {
  const s = input.system;
  const datasets = input.datasets ?? [];
  const evidence = input.evidence ?? [];
  const obligations = input.obligations ?? [];
  const sections: DossierSection[] = [];

  // ── 1. Allgemeine Beschreibung ───────────────────────────────────────────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    lines.push(`**Bezeichnung:** ${s.name}`);
    lines.push(`**Risikoklasse:** ${s.riskLabel}`);
    if (hasText(s.provider)) lines.push(`**Anbieter:** ${s.provider}`); else gaps.push('Anbieter');
    if (hasText(s.providerRole)) lines.push(`**AI-Act-Rolle:** ${s.providerRole}`); else gaps.push('AI-Act-Rolle');
    if (hasText(s.model)) lines.push(`**Modell/Version:** ${s.model}`); else gaps.push('Modell/Version');
    if (hasText(s.intendedPurpose)) lines.push(`**Zweckbestimmung:** ${s.intendedPurpose}`); else gaps.push('Zweckbestimmung (intended purpose)');
    if (hasText(s.deploymentContext)) lines.push(`**Einsatzkontext:** ${s.deploymentContext}`); else gaps.push('Einsatzkontext');
    if ((s.affectedGroups ?? []).length > 0) lines.push(`**Betroffene Gruppen:** ${s.affectedGroups!.join(', ')}`); else gaps.push('Betroffene Personengruppen');
    sections.push({ num: 1, title: 'Allgemeine Beschreibung des KI-Systems', article: 'Annex IV (1)', lines, gaps });
  }

  // ── 2. Elemente & Entwicklungsprozess (inkl. Daten-Governance Art. 10) ────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    if (hasText(s.annexCategory)) lines.push(`**Annex-III-Kategorie:** ${s.annexCategory}`); else gaps.push('Annex-III-Kategorie');
    if (datasets.length > 0) {
      lines.push('');
      lines.push('**Daten-Governance (Art. 10):**');
      lines.push('');
      lines.push('| Datensatz | Rolle | Personenbezug | Bias-Prüfung |');
      lines.push('|---|---|---|---|');
      for (const d of datasets) {
        lines.push(`| ${d.name} | ${d.role} | ${d.containsPersonalData ? 'ja' : 'nein'} | ${hasText(d.biasAssessment) ? '✓' : '—'} |`);
      }
      const pdNoBasis = datasets.filter((d) => d.containsPersonalData && !hasText(d.legalBasis));
      if (pdNoBasis.length > 0) gaps.push(`Rechtsgrundlage für ${pdNoBasis.length} personenbezogene(n) Datensatz/Datensätze`);
      const noBias = datasets.filter((d) => !hasText(d.biasAssessment));
      if (noBias.length > 0) gaps.push(`Bias-Prüfung für ${noBias.length} Datensatz/Datensätze`);
    } else {
      gaps.push('Daten-Governance-Dokumentation (Art. 10) — keine Datensätze hinterlegt');
    }
    sections.push({ num: 2, title: 'Elemente & Entwicklungsprozess', article: 'Annex IV (2)', lines, gaps });
  }

  // ── 3. Überwachung, Funktionsweise & menschliche Aufsicht (Art. 14) ───────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    if (hasText(input.oversight)) lines.push(`**Menschliche Aufsicht:** ${input.oversight}`); else gaps.push('Menschliche-Aufsicht-Maßnahmen (Art. 14)');
    sections.push({ num: 3, title: 'Überwachung, Funktionsweise & Kontrolle', article: 'Annex IV (3) · Art. 14', lines, gaps });
  }

  // ── 4. Eignung der Leistungsmetriken ─────────────────────────────────────
  {
    const lines: string[] = [];
    const gaps: string[] = ['Genauigkeits-/Robustheitsmetriken (Art. 15)'];
    lines.push('*Leistungs-, Genauigkeits- und Robustheitsmetriken sind zu ergänzen.*');
    sections.push({ num: 4, title: 'Eignung der Leistungsmetriken', article: 'Annex IV (4) · Art. 15', lines, gaps });
  }

  // ── 5. Risikomanagementsystem (Art. 9) ───────────────────────────────────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    if (obligations.length > 0) {
      const done = obligations.filter((o) => o.done).length;
      lines.push(`**Pflichten-Status:** ${done}/${obligations.length} erfüllt`);
      lines.push('');
      lines.push('| Pflicht | Norm | Status |');
      lines.push('|---|---|---|');
      for (const o of obligations) lines.push(`| ${o.label} | \`${o.article}\` | ${o.done ? '✓ erfüllt' : '○ offen'} |`);
      const open = obligations.filter((o) => !o.done);
      if (open.length > 0) gaps.push(`${open.length} offene Pflicht(en)`);
    } else {
      gaps.push('Risikomanagement-Pflichtenliste (Art. 9)');
    }
    sections.push({ num: 5, title: 'Risikomanagementsystem', article: 'Annex IV (5) · Art. 9', lines, gaps });
  }

  // ── 6. Relevante Änderungen über den Lebenszyklus ────────────────────────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    const log = input.changeLog ?? [];
    if (log.length > 0) for (const c of log) lines.push(`- ${c}`);
    else gaps.push('Änderungshistorie');
    sections.push({ num: 6, title: 'Relevante Änderungen über den Lebenszyklus', article: 'Annex IV (6)', lines, gaps });
  }

  // ── 7. Angewandte harmonisierte Normen ───────────────────────────────────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    const std = input.harmonisedStandards ?? [];
    if (std.length > 0) for (const n of std) lines.push(`- ${n}`);
    else gaps.push('Liste angewandter harmonisierter Normen');
    sections.push({ num: 7, title: 'Angewandte harmonisierte Normen', article: 'Annex IV (7) · Art. 40', lines, gaps });
  }

  // ── 8. EU-Konformitätserklärung + Nachweise ──────────────────────────────
  {
    const lines: string[] = [];
    const gaps: string[] = [];
    if (evidence.length > 0) {
      lines.push(`**Hinterlegte Nachweise:** ${evidence.length}`);
      lines.push('');
      for (const e of evidence.slice(0, 20)) {
        lines.push(`- ${e.title}${hasText(e.hash) ? ` — \`${e.hash}\`` : ''}${hasText(e.ts) ? ` (${e.ts})` : ''}`);
      }
    } else {
      gaps.push('Nachweise im Evidence-Vault');
    }
    gaps.push('Unterzeichnete EU-Konformitätserklärung');
    sections.push({ num: 8, title: 'EU-Konformitätserklärung & Nachweise', article: 'Annex IV (8) · Art. 47', lines, gaps });
  }

  // ── 9. Beobachtung nach Inverkehrbringen (Art. 72) ───────────────────────
  {
    const gaps: string[] = ['Post-Market-Monitoring-Plan (Art. 72)'];
    sections.push({
      num: 9,
      title: 'Plan zur Beobachtung nach dem Inverkehrbringen',
      article: 'Annex IV (9) · Art. 72',
      lines: ['*Post-Market-Monitoring-Plan ist zu hinterlegen.*'],
      gaps,
    });
  }

  const sectionsWithGaps = sections.filter((sec) => sec.gaps.length > 0).length;
  const completeness = Math.round((1 - sectionsWithGaps / sections.length) * 100);

  return { system: s.name, sections, completeness };
}

export function renderDossierMarkdown(dossier: ConformityDossier, registryVersion?: string): string {
  const date = new Date().toLocaleString('de-DE', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Berlin',
  });
  const lines: string[] = [];
  lines.push(`# Technische Dokumentation (Annex IV) — ${dossier.system}`);
  lines.push('');
  lines.push(`**Erstellt:** ${date}`);
  lines.push(`**Vollständigkeit:** ${dossier.completeness}%`);
  lines.push('**Rechtsgrundlage:** Anhang IV Verordnung (EU) 2024/1689');
  lines.push('');

  const totalGaps = dossier.sections.reduce((n, s) => n + s.gaps.length, 0);
  if (totalGaps > 0) {
    lines.push(`> ⚠️ **${totalGaps} offene Dokumentations-Lücke(n)** — siehe Markierungen je Abschnitt.`);
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  for (const sec of dossier.sections) {
    lines.push(`## ${sec.num}. ${sec.title}`);
    lines.push(`*${sec.article}*`);
    lines.push('');
    for (const l of sec.lines) lines.push(l);
    if (sec.gaps.length > 0) {
      lines.push('');
      lines.push('**Offene Punkte:**');
      for (const g of sec.gaps) lines.push(`- ⚠️ ${g}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Rechtlicher Hinweis');
  lines.push('');
  lines.push('Dieses Dossier ist ein **technischer Entwurf** zur Annex-IV-Dokumentation und ersetzt **keine Rechtsberatung** oder formale Konformitätsbewertung durch eine benannte Stelle.');
  lines.push('');
  lines.push(`Generiert mit RealSyncDynamics.AI${registryVersion ? ` — Annex-III-Registry v${registryVersion}` : ''}.`);
  lines.push('');

  return lines.join('\n');
}

export function downloadConformityDossier(input: DossierInput) {
  const dossier = buildConformityDossier(input);
  const md = renderDossierMarkdown(dossier, input.registryVersion);
  const date = new Date().toISOString().split('T')[0];
  const slug = (input.system.name || 'ai-system')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'ai-system';
  const filename = `annex-iv-dossier_${slug}_${date}.md`;

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
