import {
  REGISTRY_LIGHT_LABEL,
  REGISTRY_REASON_LABEL,
  type RegistryAssessment,
} from './registryModel';

/** Register-Ampel; Gründe als Tooltip (Liste) bzw. ausgeschrieben mit `withReasons`. */
export function RegistryLightBadge({
  assessment,
  lang,
  withReasons = false,
}: {
  assessment: RegistryAssessment;
  lang: 'de' | 'en';
  withReasons?: boolean;
}) {
  const reasons = assessment.reasons.map((r) => REGISTRY_REASON_LABEL[r][lang]);
  return (
    <span data-testid="registry-light" data-light={assessment.light}>
      <span className={`rs-light rs-light--${assessment.light}`} title={reasons.join(' · ') || undefined}>
        {REGISTRY_LIGHT_LABEL[assessment.light][lang]}
      </span>
      {withReasons && reasons.length > 0 && (
        <ul className="rs-reasons">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </span>
  );
}
