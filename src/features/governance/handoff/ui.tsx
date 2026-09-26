/**
 * Kleine Bausteine der Handoff-App-Screens. Farben nur über Tokens
 * (`--color-rs-*`) bzw. `CLASS_COLOR_VAR`; Maße aus governance-os-app.css.
 */
import type { CSSProperties, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ENFORCEMENT_CLASSES } from '../../../../shared/enforcement-classes';
import { CLASS_COLOR_VAR, tierDefinition, type EnforcementClass, type TierId } from './enforcementModel';
import { useLang } from '../../../i18n/useLang';
import '../../../styles/governance-os-handoff.css';
import '../../../styles/governance-os-app.css';

/** CSS-Variable `--k` für Klassen-/Stufenfarbe. */
export function colorVar(value: string): CSSProperties {
  return { ['--k' as string]: value } as CSSProperties;
}

export function ClassBadge({ klasse }: { klasse: EnforcementClass }) {
  const def = ENFORCEMENT_CLASSES[klasse];
  return (
    <span
      className="rs-classbadge"
      style={colorVar(CLASS_COLOR_VAR[klasse])}
      title={`${def.titel} — ${def.bedeutung}`}
      data-testid={`class-badge-${klasse}`}
    >
      {klasse}
    </span>
  );
}

export function TierPill({ tier }: { tier: TierId | null }) {
  const { t } = useLang();
  if (!tier) {
    return <span className="rs-tierpill">{t('tierUnknown')}</span>;
  }
  const def = tierDefinition(tier);
  return (
    <span className="rs-tierpill" style={colorVar(def.colorVar)}>
      {t(def.labelKey)}
    </span>
  );
}

export function DraftBadge() {
  const { t } = useLang();
  return (
    <span className="rs-draft" data-testid="draft-unsaved">
      {t('draftUnsaved')}
    </span>
  );
}

export function WarnToast({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div role="alert" className={`rs-toast${error ? ' rs-error' : ''}`}>
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function Panel({
  children,
  className = '',
  style,
  testId,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}) {
  return (
    <section className={`rs-panel ${className}`} style={style} data-testid={testId}>
      {children}
    </section>
  );
}

/** Kennzahl — `null` heißt unbekannt und wird als „—" gezeigt, nie als 0. */
export function StatCard({
  label,
  value,
  sub,
  accent,
  testId,
}: {
  label: string;
  value: number | null;
  sub?: string | null;
  accent?: string;
  testId?: string;
}) {
  return (
    <Panel testId={testId}>
      <div className="rs-kpi__label">{label}</div>
      <div className="rs-kpi__value" style={accent ? { color: accent } : undefined}>
        {value === null ? '—' : value}
      </div>
      {sub ? <div className="rs-kpi__sub">{sub}</div> : null}
    </Panel>
  );
}

export function formatDateTime(iso: string | null | undefined, lang: 'de' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'de' ? 'de-DE' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
