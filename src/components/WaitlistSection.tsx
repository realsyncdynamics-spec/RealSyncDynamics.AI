import React, { useEffect } from 'react';

export function WaitlistSection() {
  useEffect(() => {
    const existing = document.querySelector('script[src="https://tally.so/widgets/embed.js"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://tally.so/widgets/embed.js';
      script.async = true;
      document.head.appendChild(script);
    } else {
      // @ts-ignore
      if (typeof window.Tally !== 'undefined') {
        // @ts-ignore
        window.Tally.loadEmbeds();
      }
    }
  }, []);

  return (
    <section className="border-t border-titanium-900 bg-obsidian-950 py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-security-400">
          Fruher Zugang
        </p>
        <h2 className="mb-4 text-3xl font-bold text-titanium-100">
          Auf die Warteliste setzen
        </h2>
        <p className="mb-10 text-titanium-400">
          Erhalten Sie exklusiven Fruhzugang und werden Sie einer der ersten Nutzer von
          RealSyncDynamics.AI.
        </p>
        <iframe
          data-tally-src="https://tally.so/embed/wbzbzM?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
          loading="lazy"
          width="100%"
          height="220"
          title="Waitlist"
          className="border-0"
        />
      </div>
    </section>
  );
}
