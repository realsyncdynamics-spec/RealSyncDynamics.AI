import React, { useEffect } from 'react';

/**
 * The old preview-selector rendered three static mock cards. That is not a
 * customer-facing website builder. The unified flow now hands the audited
 * domain directly to the real SiteOS transformation experience, which can
 * discover the source site, generate a real blueprint and render it in the
 * existing SiteOS preview/builder pipeline.
 */
export default function PreviewSelectionPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const source = params.get('url') || params.get('domain') || '';
    const next = new URL('/handwerk-website', window.location.origin);
    if (source) next.searchParams.set('source_url', source);
    const auditId = params.get('auditId') || params.get('auditid');
    const score = params.get('score');
    if (auditId) next.searchParams.set('auditId', auditId);
    if (score) next.searchParams.set('score', score);
    window.location.replace(next.toString());
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f8] text-[#111827]">
      <div className="rounded-2xl border border-black/[.08] bg-white px-8 py-7 text-center shadow-xl">
        <div className="mx-auto mb-4 grid h-10 w-10 place-items-center rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
        <h1 className="text-lg font-bold">Ihre neue Website wird vorbereitet</h1>
        <p className="mt-2 text-sm text-black/50">RealSync öffnet jetzt den echten Website Builder.</p>
      </div>
    </main>
  );
}
