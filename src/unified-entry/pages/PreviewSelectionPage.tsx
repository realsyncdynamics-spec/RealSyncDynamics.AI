import React from 'react';
import WowWebsitePreview from '../../pages/WowWebsitePreview';

export default function PreviewSelectionPage() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain') || params.get('url') || '';
  const score = params.get('score') ? Number(params.get('score')) : undefined;
  const auditId = params.get('auditId') || params.get('auditid') || '';

  const handleSelection = (variantId: string) => {
    const target = new URL('/website-builder/preview', window.location.origin);
    if (domain) target.searchParams.set('domain', domain);
    if (auditId) target.searchParams.set('auditId', auditId);
    if (typeof score === 'number' && !Number.isNaN(score)) target.searchParams.set('score', String(score));
    target.searchParams.set('variant', variantId);
    window.location.assign(target.toString());
  };

  return <WowWebsitePreview domain={domain} score={score} onContinue={handleSelection} />;
}
