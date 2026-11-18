/** Leichtgewichtige Geräteprüfung ohne Three.js-Import (für Lazy Loading). */
export type QualityTier = 'high' | 'medium' | 'low';

export function detectQuality(): QualityTier {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (mem <= 2 || cores <= 2) return 'low';
  if (mobile || mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ok = !!gl;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

