import { useState } from 'react';
import { ChevronDown, ChevronRight, FileText, Globe, ShieldQuestion } from 'lucide-react';
import type { RuntimeVvtEntry, VvtLegalBasisHint, VvtProcessingType } from './types';
import {
  RuntimeVvtAiBadge,
  RuntimeVvtReviewBadge,
  RuntimeVvtRiskBadge,
} from './RuntimeVvtStatusBadge';

const TYPE_LABEL: Record<VvtProcessingType, string> = {
  website_tracking:    'Website-Tracking',
  contact_form:        'Kontaktformular',
  newsletter_form:     'Newsletter-Formular',
  ai_endpoint:         'KI-Endpunkt',
  third_party_script:  'Drittanbieter-Skript',
  analytics:           'Analytics',
  payment:             'Zahlungsabwicklung',
  embedded_media:      'Eingebettetes Medium',
  unknown:             'Unbekannt',
};

const LEGAL_LABEL: Record<VvtLegalBasisHint, string> = {
  consent:             'Einwilligung (Art. 6 Abs. 1 lit. a)',
  contract:            'Vertrag (Art. 6 Abs. 1 lit. b)',
  legitimate_interest: 'Berechtigtes Interesse (Art. 6 Abs. 1 lit. f)',
  legal_obligation:    'Rechtspflicht (Art. 6 Abs. 1 lit. c)',
  unknown:             'unbekannt — Hinweis erforderlich',
};

interface Props {
  entry: RuntimeVvtEntry;
}

export function RuntimeVvtEntryCard({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="border border-titanium-800 bg-obsidian-900">
      <header
        className="flex cursor-pointer items-start justify-between gap-3 p-4"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-titanium-500" /> : <ChevronRight className="h-3.5 w-3.5 text-titanium-500" />}
            <h3 className="truncate font-display text-sm font-semibold tracking-tight text-titanium-50">
              {entry.processingName}
            </h3>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-titanium-500">
            {TYPE_LABEL[entry.processingType]} · {entry.sourceUrl}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <RuntimeVvtRiskBadge level={entry.riskLevel} />
          <RuntimeVvtAiBadge relevance={entry.aiActRelevance} />
          <RuntimeVvtReviewBadge status={entry.reviewStatus} />
        </div>
      </header>

      {expanded ? (
        <div className="grid grid-cols-1 gap-4 border-t border-titanium-800 p-4 md:grid-cols-2">
          <Section icon={<ShieldQuestion className="h-3.5 w-3.5" />} title="Rechtsgrundlage-Hinweis">
            <p className="text-sm text-titanium-200">{LEGAL_LABEL[entry.legalBasisHint]}</p>
            <p className="mt-1 text-[11px] text-titanium-500">
              Hinweis — keine Rechtsfreigabe. DSB- oder Fachjurist-Review erforderlich.
            </p>
          </Section>

          <Section icon={<Globe className="h-3.5 w-3.5" />} title="Drittland-Übertragung">
            <p className="text-sm text-titanium-200">
              {entry.thirdCountryTransfer ? 'Ja — Vendor außerhalb EU erkannt' : 'Keine Hinweise auf Drittland-Transfer'}
            </p>
          </Section>

          <Section title="Datenkategorien">
            <Tags items={entry.dataCategories} />
          </Section>

          <Section title="Betroffene Personengruppen">
            <Tags items={entry.affectedPersons} />
          </Section>

          <Section title="Zwecke">
            <Tags items={entry.purposes} />
          </Section>

          <Section title="Anbieter / Drittparteien">
            {entry.vendors.length === 0 ? (
              <p className="text-[11px] text-titanium-500">Keine Anbieter erkannt.</p>
            ) : (
              <ul className="space-y-1">
                {entry.vendors.map((v) => (
                  <li key={v.domain} className="font-mono text-[11px] text-titanium-300">
                    <span className="text-titanium-50">{v.name}</span>
                    <span className="text-titanium-500"> · {v.domain} · {v.category} · {v.countryHint}</span>
                    {v.dpaRequired ? <span className="text-amber-300"> · AVV erforderlich</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section icon={<FileText className="h-3.5 w-3.5" />} title="Nachweise">
            {entry.detectedFromEventIds.length === 0 ? (
              <p className="text-[11px] text-titanium-500">Keine Event-Referenzen.</p>
            ) : (
              <ul className="space-y-0.5">
                {entry.detectedFromEventIds.map((id) => (
                  <li key={id} className="font-mono text-[11px] text-titanium-400">{id}</li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      ) : null}
    </article>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1.5 flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function Tags({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-[11px] text-titanium-500">—</p>;
  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((it) => (
        <li key={it} className="border border-titanium-800 bg-obsidian-950 px-1.5 py-0.5 font-mono text-[11px] text-titanium-300">
          {it}
        </li>
      ))}
    </ul>
  );
}
