// Einordnung fremder Hosts und Pfade.
//
// Eine Liste bekannter Anbieter statt einer Heuristik: Ob ein Skript Analytics
// oder ein Buchungswidget ist, lässt sich am Host zuverlässig ablesen und
// sonst nicht. Ein unbekannter Host bleibt `other` — er wird nicht erraten.

import type { ThirdPartyCategory } from './types.ts';

const CATEGORY_HOSTS: ReadonlyArray<readonly [ThirdPartyCategory, readonly string[]]> = [
  ['analytics', [
    'google-analytics.com', 'googletagmanager.com', 'analytics.google.com', 'hotjar.com', 'hotjar.io',
    'clarity.ms', 'matomo.cloud', 'plausible.io', 'mouseflow.com', 'etracker.com', 'etracker.de',
    'smartlook.com', 'mixpanel.com', 'segment.com', 'segment.io', 'heapanalytics.com', 'fullstory.com',
    'static.cloudflareinsights.com', 'analytics.tiktok.com', 'econda.de', 'webtrekk.net', 'wt-safetag.com',
  ]],
  ['ads', [
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'connect.facebook.net', 'facebook.net',
    'snap.licdn.com', 'px.ads.linkedin.com', 'bat.bing.com', 'ads-twitter.com', 'static.ads-twitter.com',
    'taboola.com', 'outbrain.com', 'criteo.com', 'criteo.net', 'adnxs.com', 'adform.net', 'pinimg.com',
  ]],
  ['fonts', [
    'fonts.googleapis.com', 'fonts.gstatic.com', 'use.typekit.net', 'p.typekit.net', 'fonts.bunny.net',
    'use.fontawesome.com', 'kit.fontawesome.com', 'fast.fonts.net', 'cloud.typography.com',
  ]],
  ['maps', [
    'maps.googleapis.com', 'maps.google.com', 'maps.gstatic.com', 'tile.openstreetmap.org', 'openstreetmap.org',
    'api.mapbox.com', 'api.tiles.mapbox.com', 'here.com',
  ]],
  ['video', [
    'youtube.com', 'youtube-nocookie.com', 'ytimg.com', 'player.vimeo.com', 'vimeo.com', 'vimeocdn.com',
    'wistia.com', 'wistia.net', 'dailymotion.com',
  ]],
  ['booking', [
    'calendly.com', 'doctolib.de', 'doctolib.com', 'etermin.net', 'termin-direkt.de', 'shore.com',
    'simplybook.me', 'simplybook.it', 'timify.com', 'bookingkit.de', 'bookingkit.net', 'acuityscheduling.com',
    'terminland.de', 'samedi.de', 'planity.com', 'treatwell.de', 'opentable.de', 'opentable.com', 'quandoo.de',
    'resmio.com', 'youcanbook.me', 'zcal.co', 'cal.com', 'tidycal.com', 'terminbuchung.de', 'dr-flex.de',
  ]],
  ['payment', [
    'paypal.com', 'paypalobjects.com', 'paypal.me', 'js.stripe.com', 'buy.stripe.com', 'checkout.stripe.com',
    'stripe.com', 'klarna.com', 'mollie.com', 'sumup.com', 'sofort.com', 'adyen.com', 'braintreegateway.com',
    'digistore24.com', 'copecart.com', 'elopage.com', 'ablefy.io', 'paddle.com', 'lemonsqueezy.com',
  ]],
  ['form', [
    'hsforms.net', 'hsforms.com', 'typeform.com', 'jotform.com', 'formspree.io', 'cognitoforms.com', 'tally.so',
    'forms.office.com', 'forms.gle', '123formbuilder.com', 'wufoo.com', 'formstack.com', 'getform.io',
    'list-manage.com', 'sendinblue.com', 'brevo.com', 'cleverreach.com', 'klaviyo.com', 'rapidmail.de',
    'newsletter2go.com', 'mailerlite.com', 'zohopublic.eu',
  ]],
  ['consent', [
    'cookiebot.com', 'usercentrics.eu', 'usercentrics.com', 'onetrust.com', 'cookielaw.org', 'consentmanager.net',
    'cookie-script.com', 'iubenda.com', 'ccm19.de', 'cookieyes.com', 'didomi.io', 'trustarc.com',
    'cookiefirst.com', 'consensu.org',
  ]],
  ['reviews', [
    'provenexpert.com', 'trustpilot.com', 'trustedshops.com', 'trustedshops.de', 'ekomi.de', 'ekomi.com',
    'kununu.com', 'yelp.com', 'golocal.de', 'werkenntdenbesten.de', 'reviews.io', 'judge.me', 'yotpo.com',
    'shopauskunft.de', 'anwalt.de', 'jameda.de',
  ]],
  ['chat', [
    'tawk.to', 'intercom.io', 'intercomcdn.com', 'crisp.chat', 'userlike.com', 'userlike-cdn-widgets.s3-eu-west-1.amazonaws.com',
    'zdassets.com', 'zendesk.com', 'livechatinc.com', 'drift.com', 'tidio.co', 'tidiochat.com', 'smartsupp.com',
    'chatbase.co', 'landbot.io', 'voiceflow.com', 'moin.ai', 'botpress.cloud', 'chatwoot.com',
  ]],
  ['social', [
    'facebook.com', 'instagram.com', 'linkedin.com', 'xing.com', 'twitter.com', 'x.com', 'tiktok.com',
    'pinterest.com', 'threads.net', 'mastodon.social',
  ]],
  ['cdn', [
    'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'code.jquery.com', 'ajax.googleapis.com',
    'stackpath.bootstrapcdn.com', 'maxcdn.bootstrapcdn.com', 'cloudfront.net', 'akamaihd.net', 'fastly.net',
    'wp.com', 'gravatar.com', 'polyfill.io', 'jsdelivr.net',
  ]],
];

export function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Kategorie eines Hosts; `path` löst Sonderfälle wie `google.com/maps`. */
export function categorizeHost(host: string, path = ''): ThirdPartyCategory {
  const h = host.toLowerCase();
  if ((hostMatches(h, 'google.com') || hostMatches(h, 'google.de')) && path.startsWith('/maps')) return 'maps';
  if ((hostMatches(h, 'docs.google.com')) && path.startsWith('/forms')) return 'form';
  for (const [category, domains] of CATEGORY_HOSTS) {
    if (domains.some((d) => hostMatches(h, d))) return category;
  }
  return 'other';
}

/** Zweistufige Endungen, bei denen die registrierbare Domain drei Teile hat. */
const SECOND_LEVEL = new Set(['co', 'com', 'org', 'net', 'gov', 'ac', 'edu']);

/** Registrierbare Domain in einfacher Näherung (`www.shop.beispiel.de` → `beispiel.de`). */
export function baseDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  if (tld.length === 2 && SECOND_LEVEL.has(second)) return labels.slice(-3).join('.');
  return labels.slice(-2).join('.');
}

/** Gehört `host` zur selben Website wie `pageHost`? (www und Subdomains inklusive) */
export function sameSite(host: string, pageHost: string): boolean {
  return baseDomain(host) === baseDomain(pageHost);
}

const BOOKING_PATH = /(^|\/)(termin|termine|terminbuchung|online-termin|booking|buchen|buchung|reservierung|reservieren|appointment)(\/|$|[-_.])/i;
const PAYMENT_PATH = /(^|\/)(checkout|warenkorb|cart|kasse|bezahlen|payment|zahlung)(\/|$|[-_.])/i;
const SHOP_PATH = /(^|\/)(shop|store|onlineshop|bestellen|warenkorb)(\/|$|[-_.])/i;

/** Ordnet einen Link als Backend-Strecke ein — oder `null`, wenn es keine ist. */
export function backendLinkKind(url: URL, pageHost: string): 'payment' | 'booking' | 'shop' | null {
  const category = categorizeHost(url.hostname, url.pathname);
  if (category === 'payment') return 'payment';
  if (category === 'booking') return 'booking';
  if (!sameSite(url.hostname, pageHost)) return null;
  if (PAYMENT_PATH.test(url.pathname)) return 'payment';
  if (BOOKING_PATH.test(url.pathname)) return 'booking';
  if (SHOP_PATH.test(url.pathname)) return 'shop';
  return null;
}

/** Soziale Netzwerke — nur Profil-Links, keine Tracking-Hosts. */
export function socialNetwork(host: string): string | null {
  const h = host.toLowerCase();
  const map: [string, string][] = [
    ['facebook.com', 'Facebook'], ['instagram.com', 'Instagram'], ['linkedin.com', 'LinkedIn'], ['xing.com', 'XING'],
    ['twitter.com', 'X'], ['x.com', 'X'], ['youtube.com', 'YouTube'], ['tiktok.com', 'TikTok'], ['pinterest.com', 'Pinterest'],
  ];
  for (const [domain, label] of map) if (hostMatches(h, domain)) return label;
  return null;
}
