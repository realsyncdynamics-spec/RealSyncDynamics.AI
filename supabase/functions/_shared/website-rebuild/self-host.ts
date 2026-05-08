// Step 4 — self_host: Google-Fonts und andere unkritische 3rd-Party-Resources
// auf den eigenen Origin proxyen, damit kein US-Transfer mehr passiert.
//
// Strategie: Google-Fonts CSS wird zur Build-Zeit inline-eingebettet und die
// .woff2-URLs auf einen lokalen /assets/fonts/-Pfad umgeschrieben. Das
// tatsächliche Download + Storage-Upload passiert in Step package_deploy.

const GOOGLE_FONTS_LINK_RE =
  /<link[^>]+href=["']https?:\/\/fonts\.googleapis\.com\/css2?\?([^"']+)["'][^>]*>/gi;

const GOOGLE_FONTS_PRECONNECT_RE =
  /<link[^>]+(?:href=["']https?:\/\/fonts\.(?:googleapis|gstatic)\.com["'])[^>]*>/gi;

export function selfHostFonts(html: string): {
  rewrittenHtml: string;
  fontsToDownload: string[];
} {
  const fontsToDownload = new Set<string>();

  // Preconnect-Hints zu fonts.* entfernen — wir hosten selbst
  let out = html.replace(GOOGLE_FONTS_PRECONNECT_RE, '<!-- preconnect-removed-by-rebuild -->');

  // Google-Fonts CSS-Link → Self-Hosted-CSS-Pfad
  out = out.replace(GOOGLE_FONTS_LINK_RE, (_full, query: string) => {
    const familyMatch = /family=([^&]+)/.exec(query);
    if (familyMatch) {
      for (const fam of familyMatch[1].split('|')) {
        fontsToDownload.add(decodeURIComponent(fam));
      }
    }
    return `<link rel="stylesheet" href="/assets/fonts/local.css">`;
  });

  // Inline-CSS mit @import url('https://fonts.googleapis.com/...') auch fangen
  out = out.replace(
    /@import\s+url\(["']?https?:\/\/fonts\.googleapis\.com\/[^"')]+["']?\);?/gi,
    '@import url("/assets/fonts/local.css");'
  );

  return {
    rewrittenHtml: out,
    fontsToDownload: [...fontsToDownload],
  };
}
