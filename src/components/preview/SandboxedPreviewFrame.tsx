import type { CSSProperties } from 'react';
import { sandboxTokens, withPreviewCsp, type PreviewIsolation } from '../../lib/preview-sandbox';

/**
 * Der einzige Rahmen, in dem erzeugte Vorschau-Seiten angezeigt werden.
 *
 * Er nimmt die Isolierung aus `src/lib/preview-sandbox.ts` und setzt sie
 * zusammen: `sandbox`-Marken **und** die eingebettete
 * Content-Security-Policy. Beides gehört zusammen — die eine Massnahme ohne
 * die andere lässt jeweils eine Lücke.
 *
 * Es gibt bewusst keine Möglichkeit, das `sandbox`-Attribut von aussen zu
 * überschreiben. Ein solcher Ausweg würde bei der ersten Anforderung
 * genutzt, die „nur kurz" mehr Rechte braucht.
 */
interface SandboxedPreviewFrameProps {
  /** Vollständiges HTML-Dokument der Vorschau. */
  html: string;
  /** Barrierefreier Name des Rahmens. */
  title: string;
  /** `static` = ohne JavaScript (heutiger Stand), `interactive` = mit, in opaker Herkunft. */
  isolation?: PreviewIsolation;
  className?: string;
  style?: CSSProperties;
  /**
   * Vorschaubild statt bedienbarer Vorschau: Der Rahmen wird für
   * Hilfstechnologien ausgeblendet und nimmt keine Zeigereingaben entgegen.
   */
  decorative?: boolean;
}

export function SandboxedPreviewFrame({
  html,
  title,
  isolation = 'static',
  className,
  style,
  decorative = false,
}: SandboxedPreviewFrameProps) {
  return (
    <iframe
      title={title}
      srcDoc={withPreviewCsp(html, isolation)}
      sandbox={sandboxTokens(isolation)}
      referrerPolicy="no-referrer"
      // Ohne diese Sperre könnte eine Vorschau Kamera, Mikrofon oder Standort
      // anfordern. Für eine Gestaltungsvorschau gibt es dafür keinen Grund.
      allow=""
      className={className}
      style={style}
      {...(decorative ? { 'aria-hidden': true as const, tabIndex: -1 } : {})}
    />
  );
}
