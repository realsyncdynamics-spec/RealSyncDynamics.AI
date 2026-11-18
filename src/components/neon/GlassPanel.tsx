import type { HTMLAttributes, ReactNode } from 'react';
import '../../styles/glass-tokens.css';

/**
 * GlassPanel — wiederverwendbare Glasfläche des Glaswürfel-Designsystems
 * (Tokens in styles/glass-tokens.css). Rein darstellend; Semantik (Region,
 * Überschrift) setzt der Aufrufer über `as` und Attribute.
 */
export interface GlassPanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'aside';
  /** Leuchtende Kante (Cyan/Lila) für hervorgehobene Flächen. */
  glow?: boolean;
  children?: ReactNode;
}

export function GlassPanel({ as: Tag = 'div', glow = false, className, children, ...rest }: GlassPanelProps) {
  return (
    <Tag {...rest} className={`rs-glass rs-g-panel${className ? ` ${className}` : ''}`} data-glow={glow}>
      {children}
    </Tag>
  );
}
