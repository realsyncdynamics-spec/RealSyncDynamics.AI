import { useState } from 'react';
import { SyncStage, SYNC_STILL_SRC } from '../../visual/sync-mascot/SyncStage';

/**
 * Public video is optional. A Higgsfield render may only replace the
 * canonical SYNC stage after the export has been approved as depicting
 * the SAME character from our master GLB.
 *
 * Fail-closed to self-hosted media. The opt-in is an editorial release
 * flag, not proof of legal rights or a successful live voice runtime.
 */
const PUBLIC_VIDEO_URL = import.meta.env.VITE_HIGGSFIELD_BOT_VIDEO_URL?.trim() ?? '';
const APPROVED_SYNC_EXPORT = import.meta.env.VITE_HIGGSFIELD_BOT_VERIFIED_SYNC === 'true';

export function approvedSyncVideoUrl(url: string, verified: boolean): string | null {
  if (!verified || !/^\/(?!\/)(?!.*\.\.)[^?#]+\.(?:mp4|webm)(?:\?[^#]*)?$/i.test(url)) return null;
  return url;
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export function HiggsfieldBotHero({ active, caption }: { active: number; caption: string }) {
  const [failed, setFailed] = useState(false);
  const video = approvedSyncVideoUrl(PUBLIC_VIDEO_URL, APPROVED_SYNC_EXPORT);

  if (!video || failed || reducedMotion()) {
    return <SyncStage variant="home" caption={caption} statusLabel="SYNC · 3D" waveSignal={active} />;
  }
  return (
    <div className="lv3-stage lv3-higgsfield-hero" data-testid="higgsfield-bot-hero">
      <video
        className="lv3-higgsfield-video"
        src={video}
        poster={SYNC_STILL_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-label="SYNC: freigegebene Animation der RealSync-3D-Markenfigur"
        onError={() => setFailed(true)}
      />
      <span className="lv3-stage-tag">SYNC · Originalvideo</span>
      <span className="lv3-stage-caption">{caption}</span>
    </div>
  );
}
