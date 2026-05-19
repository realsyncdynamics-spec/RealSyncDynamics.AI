// BrandMarkSection — brand-signature closer at the bottom of the Landing.
// The 3D wordmark mark is lazy-loaded (below the fold) so the 1.7 MB asset
// doesn't impact LCP. Hard-edge industrial: thin obsidian border, monospace
// caption, no rounded corners on the frame.

export function BrandMarkSection() {
  return (
    <section
      aria-label="Brand mark"
      className="bg-obsidian-950 border-t border-titanium-900 px-4 sm:px-6 py-20 sm:py-24"
    >
      <div className="max-w-5xl mx-auto text-center">
        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-titanium-500 mb-8">
          ◇ realsync dynamics · ai governance runtime
        </div>

        <div className="inline-block border border-titanium-900 bg-obsidian-900 p-6 sm:p-10">
          <img
            src="/brand/realsync-3d-mark.png"
            alt="RealSync Dynamics.AI"
            loading="lazy"
            decoding="async"
            width={836}
            height={470}
            className="block max-w-full h-auto mx-auto"
            style={{ maxWidth: '480px' }}
          />
        </div>

        <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-titanium-500">
          eu-frankfurt · audit-grade · governance-native
        </div>
      </div>
    </section>
  );
}
