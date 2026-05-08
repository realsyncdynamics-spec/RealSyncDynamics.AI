import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
 *   - Desktop ≥ threeJsBreakpoint → upgrade to 3D once the element is within
 *     200px of the viewport (IntersectionObserver), then lazy-load AiCoreScene
 *
 * The IO deferral means vendor-three.js does not even start downloading until
 * the user has scrolled close to the WatchmakerShowcase section. SVG renders
 * synchronously throughout, including as Suspense fallback while the chunk
 * resolves — zero layout-jump.
 */
export function AiCoreInteractive({ size = 360, className, threeJsBreakpoint = 1024 }: Props) {
  const [tier, setTier] = useState<'svg' | '3d'>('svg');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (tier === '3d') return; // already upgraded — nothing to do

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const isCapableViewport = () => window.innerWidth >= threeJsBreakpoint;
    const node = wrapperRef.current;

    let observer: IntersectionObserver | null = null;

    const armObserver = () => {
      if (!isCapableViewport() || !node) return;
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setTier('3d');
            observer?.disconnect();
            observer = null;
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(node);
    };

    armObserver();

    const onResize = () => {
      if (!observer && isCapableViewport()) armObserver();
    };
    window.addEventListener('resize', onResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [threeJsBreakpoint, tier]);

  return (
    <div
      ref={wrapperRef}
      className={className}
      style={{ width: size, height: size, position: 'relative' }}
      aria-hidden="true"
    >
      {tier === 'svg' ? (
        <AiCoreVisual size={size} />
      ) : (
        <Suspense fallback={<AiCoreVisual size={size} />}>
          <AiCoreScene />
        </Suspense>
      )}
    </div>
  );
}
