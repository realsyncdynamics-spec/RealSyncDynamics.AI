import { lazy, Suspense, useEffect, useState } from 'react';
import { AiCoreVisual } from './AiCoreVisual';

const AiCoreScene = lazy(() => import('./AiCoreScene'));

type Props = {
  /** Side length in px. Default 360. */
  size?: number;
  /** Optional className for the wrapping element. */
  className?: string;
  /** Min viewport width for which to load the 3D scene. Default 1024. */
  threeJsBreakpoint?: number;
};

/**
 * AiCoreInteractive — picks the right rendering tier:
 *   - Mobile / tablet (< threeJsBreakpoint) → static SVG (AiCoreVisual)
 *   - prefers-reduced-motion → static SVG
 *   - Otherwise on desktop → lazy-load AiCoreScene (Three.js / R3F)
 *
 * SVG renders synchronously as Suspense fallback so there is no layout-jump
 * while the three chunk downloads. When the 3D scene is ready, it overlays
 * the SVG seamlessly.
 */
export function AiCoreInteractive({ size = 360, className, threeJsBreakpoint = 1024 }: Props) {
  const [tier, setTier] = useState<'svg' | '3d'>('svg');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;
    const update = () => {
      setTier(window.innerWidth >= threeJsBreakpoint ? '3d' : 'svg');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [threeJsBreakpoint]);

  if (tier === 'svg') {
    return <AiCoreVisual size={size} className={className} />;
  }

  return (
    <div className={className} style={{ width: size, height: size, position: 'relative' }} aria-hidden="true">
      <Suspense fallback={<AiCoreVisual size={size} />}>
        <AiCoreScene />
      </Suspense>
    </div>
  );
}
