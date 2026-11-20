import { useState } from 'react';
import { HeroStage } from './HeroStage';

/**
 * Haupt-Hero: originaler Higgsfield-3D-Bot, sobald ein freigegebener
 * MP4/WebM-Export als öffentliche URL konfiguriert ist.
 *
 * VITE_HIGGSFIELD_BOT_VIDEO_URL ist nur die öffentliche Medien-URL
 * (kein Token/Secret). Kein Cross-Origin-iframe und kein erfundener Export.
 * Ohne gültigen Film bleibt die vorhandene lokale Three.js-Bühne aktiv.
 */
const PUBLIC_VIDEO_URL = import.meta.env.VITE_HIGGSFIELD_BOT_VIDEO_URL?.trim() ?? '';

function reducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function HiggsfieldBotHero({ active, caption }: { active: number; caption: string }) {
  const [failed, setFailed] = useState(false);
  if (!PUBLIC_VIDEO_URL || failed || reducedMotion()) {
    return <HeroStage active={active} caption={caption} statusLabel="3D · Vorschau" />;
  }
  return (
    <div className="lv3-stage lv3-higgsfield-hero" data-testid="higgsfield-bot-hero">
      <video
        className="lv3-higgsfield-video"
        src={PUBLIC_VIDEO_URL}
        poster="/landing-v3/hero-still.jpg"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label="Animierter RealSync 3D-Bot"
        onError={() => setFailed(true)}
      />
      <span className="lv3-stage-caption">{caption}</span>
    </div>
  );
}
