import type { RuntimeVvtEntry, VvtLegalBasisHint, VvtProcessingType } from './types';
import {
  AiActRelevanceBadge,
  ReviewStatusBadge,
  RiskLevelBadge,
} from './RuntimeVvtStatusBadge';

const PROCESSING_LABEL: Record<VvtProcessingType, string> = {
  website_tracking:     'Website-Tracking',
  contact_form:         'Kontaktformular',
  newsletter_form:      'Newsletter-Formular',
  ai_endpoint:          'AI-Endpunkt',
  third_party_script:   'Drittanbieter-Skript',
  analytics:            'Analytics',
  payment:              'Zahlung',
  embedded_media:       'Eingebettete Medien',
  unknown:              'Unbekannt',
};

const LEGAL_LABEL: Record<VvtLegalBasisHint, string> = {
  consent:              'Einwilligung (Hinweis)',
  contract:             'Vertrag (Hinweis)',
  legitimate_interest:  'Berechtigtes Interesse (Hinweis)',
  legal_obligation:     'Rechtliche Verpflichtung (Hinweis)',
  unknown:              'Rechtsgrundlage unklar — Review',
};

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-t border-titanium-800/60 py-2 text-sm">
      <span className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">
        {label}
      </span>
      <span className="text-titanium-200">{value}</span>
    </div>
  );
}

export function RuntimeVvtEntryCard({ entry }: { entry: RuntimeVvtEntry }) {
  return (
    <article className="border border-titanium-800 bg-obsidian-950 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-titanium-500">
            {PROCESSING_LABEL[entry.processing_type]}
          </p>
          <h3 className="mt-1 font-display text-base font-bold text-titanium-50">
            {entry.processing_name}
          </h3>
          {entry.source_url ? (
            <p className="mt-1 break-all font-mono text-xs text-titanium-400">
              {entry.source_url}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReviewStatusBadge status={entry.review_status} />
          <RiskLevelBadge   level={entry.risk_level} />
          <AiActRelevanceBadge relevance={entry.ai_act_relevance} />
        </div>
      </header>

      <div className="mt-4">
        <MetaRow
          label="Datenkategorien"
          value={
            entry.data_categories.length === 0
              ? <span className="text-titanium-500">— keine erkannt —</span>
              : entry.data_categories.join(', ')
          }
        />
        <MetaRow
          label="Betroffene"
          value={
            entry.affected_persons.length === 0
              ? <span className="text-titanium-500">— unbekannt —</span>
              : entry.affected_persons.join(', ')
          }
        />
        <MetaRow
          label="Zweck-Hinweise"
          value={
            entry.purposes.length === 0
              ? <span className="text-titanium-500">— unbekannt —</span>
              : entry.purposes.join(', ')
          }
        />
        <MetaRow
          label="Rechtsgrundlage-Hinweis"
          value={LEGAL_LABEL[entry.legal_basis_hint]}
        />
        <MetaRow
          label="Drittland-Transfer"
          value={entry.third_country_transfer ? 'möglich — Review' : 'nicht erkannt'}
        />
        <MetaRow
          label="Vendoren"
          value={
            entry.vendors.length === 0 ? (
              <span className="text-titanium-500">— keine erkannt —</span>
            ) : (
              <ul className="space-y-1">
                {entry.vendors.map((vendor) => (
                  <li key={`${vendor.name}-${vendor.domain}`} className="font-mono text-xs text-titanium-200">
                    <span className="text-titanium-50">{vendor.name}</span>
                    {vendor.domain ? <> · {vendor.domain}</> : null}
                    {vendor.country_hint ? <> · {vendor.country_hint}</> : null}
                    {vendor.dpa_required ? <> · AVV benötigt</> : null}
                    {' · '}Transfer-Risiko: {vendor.transfer_risk_hint}
                  </li>
                ))}
              </ul>
            )
          }
        />
        <MetaRow
          label="Nachweise"
          value={
            entry.evidence_refs.length === 0 ? (
              <span className="text-titanium-500">— keine verknüpft —</span>
            ) : (
              <ul className="space-y-0.5 font-mono text-xs text-titanium-300">
                {entry.evidence_refs.map((ref) => (
                  <li key={ref}>{ref}</li>
                ))}
              </ul>
            )
          }
        />
        <MetaRow
          label="Aus Events"
          value={
            entry.detected_from_event_ids.length === 0 ? (
              <span className="text-titanium-500">— ohne Event-Bezug —</span>
            ) : (
              <span className="font-mono text-xs text-titanium-300">
                {entry.detected_from_event_ids.join(', ')}
              </span>
            )
          }
        />
      </div>

      <footer className="mt-3 border-t border-titanium-800/60 pt-2 text-[11px] text-titanium-500">
        Aus Runtime-Ereignissen abgeleitet · keine rechtliche Bewertung · Human Review nötig
      </footer>
    </article>
  );
}
