import React, { useEffect } from 'react';
import WowWebsitePreview from '../../pages/WowWebsitePreview';
import { trackTransformationEvent } from '../../lib/business/transformationFunnelTelemetry';

export default function WowPreviewEntryPage() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain') || params.get('url') || '';
  const scoreValue = params.get('score');
  const score = scoreValue ? Number(scoreValue) : undefined;
  const auditId = params.get('auditId') || params.get('auditid') || '';

  useEffect(() => {
    void trackTransformationEvent('preview_completed', { source: 'wow_preview' });
  }, []);

  const continueToFullPreview = (variantId: string) => {
    void trackTransformationEvent('transformation_cta_clicked', {
      variant: variantId,
      source: 'wow_preview',
    });

    const next = new URL('/unified-entry/transformation', window.location.origin);
    if (domain) next.searchParams.set('domain', domain);
    if (auditId) next.searchParams.set('auditId', auditId);
    next.searchParams.set('variant', variantId);
    window.location.assign(next.toString());
  };

  return <WowWebsitePreview domain={domain} score={score} onContinue={continueToFullPreview} />;
}
