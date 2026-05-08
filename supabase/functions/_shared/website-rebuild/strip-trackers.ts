// Step 3 — strip_trackers: alle DSGVO-kritischen 3rd-Party-Embeds raus.
//
// Pattern-basiert (keine vollständige DOM-Parser-Lib, hält Edge-Function-
// Bundle klein). Ziel ist Server-side string-replace, das den vorhandenen
// HTML-Look beibehält aber tracking-Code neutralisiert.

import type { ScrapedSite, RemediationReport } from './types.ts';

// Bekannte Tracker-Domains und Script-Patterns.
const TRACKER_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'Google Analytics (gtag)',     re: /googletagmanager\.com\/gtag\/js/i },
  { name: 'Google Tag Manager',          re: /googletagmanager\.com\/gtm\.js/i },
  { name: 'Google Analytics (UA)',       re: /google-analytics\.com\/analytics\.js/i },
  { name: 'Facebook Pixel',              re: /connect\.facebook\.net\/[^/]+\/fbevents\.js/i },
  { name: 'LinkedIn Insight',            re: /snap\.licdn\.com\/li\.lms-analytics/i },
  { name: 'TikTok Pixel',                re: /analytics\.tiktok\.com\/i18n\/pixel/i },
  { name: 'Hotjar',                      re: /static\.hotjar\.com\/c\/hotjar-/i },
  { name: 'Microsoft Clarity',           re: /www\.clarity\.ms\/tag/i },
  { name: 'Segment',                     re: /cdn\.segment\.com\/analytics\.js/i },
  { name: 'Mixpanel',                    re: /cdn\.mxpnl\.com\/libs\/mixpanel/i },
  { name: 'Pinterest Tag',               re: /s\.pinimg\.com\/ct\/core\.js/i },
  { name: 'Twitter Pixel',               re: /static\.ads-twitter\.com\/uwt\.js/i },
  { name: 'Snap Pixel',                  re: /sc-static\.net\/scevent\.min\.js/i },
  { name: 'Doubleclick',                 re: /doubleclick\.net\/(?:gpt|instream)/i },
  { name: 'Reddit Pixel',                re: /www\.redditstatic\.com\/ads\/pixel\.js/i },
];

// Bekannte 3rd-Party-Iframe-Provider die EU/EWR-Outflows triggern.
const IFRAME_NEUTRALIZE = [
  'youtube.com/embed',
  'youtube-nocookie.com/embed',
  'player.vimeo.com',
  'maps.google.com',
  'google.com/maps',
  'instagram.com/p/',
  'facebook.com/plugins',
  'twitter.com/widgets',
  'platform.twitter.com',
];

export function stripTrackers(scraped: ScrapedSite): {
  cleanedHtml: string;
  report: RemediationReport;
} {
  let html = scraped.html;
  const report: RemediationReport = {
    trackersRemoved: [],
    iframesNeutralized: [],
    fontsSelfHosted: [],
    scriptsRemoved: 0,
    scriptsKept: 0,
    warnings: [],
  };

  // Externe <script src="..."> entfernen wenn sie Tracker matchen
  html = html.replace(/<script[^>]+src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (full, src) => {
    const hit = TRACKER_PATTERNS.find((p) => p.re.test(src));
    if (hit) {
      report.trackersRemoved.push(hit.name);
      report.scriptsRemoved++;
      return `<!-- removed by RealSync DSGVO-Rebuild: ${hit.name} -->`;
    }
    report.scriptsKept++;
    return full;
  });

  // Inline-Scripts mit Tracker-Aufrufen neutralisieren
  html = html.replace(/<script(?![^>]+src=)[^>]*>([\s\S]*?)<\/script>/gi, (full, body) => {
    if (
      /\bgtag\s*\(|\b_ga\b|fbq\s*\(|_fbq\.push|hj\s*\(|clarity\s*\(|analytics\.track\s*\(|mixpanel\.track/i.test(body)
    ) {
      report.scriptsRemoved++;
      report.trackersRemoved.push('Inline tracking call');
      return '<!-- inline tracking removed by RealSync DSGVO-Rebuild -->';
    }
    return full;
  });

  // Iframes neutralisieren — durch Click-to-Load-Placeholder ersetzen
  html = html.replace(/<iframe[^>]+src=["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi, (full, src) => {
    if (IFRAME_NEUTRALIZE.some((needle) => src.includes(needle))) {
      report.iframesNeutralized.push(src);
      return clickToLoadPlaceholder(src);
    }
    return full;
  });

  // Google-Fonts <link> markieren — werden in Step self_host gehandelt
  if (/fonts\.googleapis\.com/.test(html)) {
    report.warnings.push('Google Fonts detected — wird in self_host-Step ersetzt');
  }

  return { cleanedHtml: html, report };
}

function clickToLoadPlaceholder(originalSrc: string): string {
  const safe = originalSrc.replace(/"/g, '&quot;');
  return `<div class="rsd-click-to-load" data-src="${safe}" role="button" tabindex="0"
    style="background:#101013;border:1px solid #2a2a30;color:#E2E2E2;
           padding:1.5rem;border-radius:6px;text-align:center;cursor:pointer;">
    <strong>Externer Inhalt</strong><br>
    <span style="font-size:0.875rem;opacity:0.8;">
      Klicken Sie zum Laden &mdash; verbindet zu Drittanbieter-Server.
    </span>
  </div>`;
}
