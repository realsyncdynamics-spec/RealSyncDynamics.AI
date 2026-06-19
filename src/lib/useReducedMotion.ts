/**
 * useReducedMotion — schlanker Hook, der `prefers-reduced-motion: reduce`
 * beobachtet (ohne Framer-Motion-Abhängigkeit, nutzbar in Three.js-Code).
 */
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

export default useReducedMotion;
