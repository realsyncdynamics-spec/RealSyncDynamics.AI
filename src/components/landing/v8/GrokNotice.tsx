import { grokNoticeText } from '../../../marketing/landing-v8/public-config';

/** Sichtbar nur, wenn `VITE_V8_GROK_NOTICE=1`. */
export function GrokNotice() {
  const text = grokNoticeText();
  if (!text) return null;
  return <p data-testid="v8-grok-notice">{text}</p>;
}
