import { Puzzle, RefreshCw, Globe } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const CONFIG: NicheConfig = {
  segment: 'WordPress',
  sourceTag: 'wordpress-dsgvo',
  eyebrow: 'WordPress & DSGVO',
  headline: 'WordPress ist das beliebteste CMS — und der häufigste Grund für DSGVO-Abmahnungen.',
  subline:
    'Jede Plugin-Aktualisierung, jedes neue Theme, jede eingebettete Google-Fonts-Schrift kann Ihre Compliance-Status kippen. Wir prüfen Ihre WordPress-Website automatisch auf alle relevanten DSGVO-Risiken — kostenlos, in 30 Sekunden, ohne Installation.',
  primaryCtaHref: '/audit?source=wordpress-dsgvo',
  primaryCtaLabel: 'WordPress-Site jetzt kostenlos prüfen',
  painCards: [
    {
      Icon: Puzzle,
      title: 'Plugin-Update → Tracker lädt vor Consent',
      body: 'Woo-Commerce, Yoast, Contact Form 7, WPForms — viele Plugins binden externe Skripte ohne Consent-Wrapper ein. Nach dem Update läuft GA4 oder Facebook Pixel wieder unkontrolliert. Ohne Monitoring merken Sie es erst nach der Abmahnung.',
    },
    {
      Icon: Globe,
      title: 'Google Fonts lädt extern — automatische IP-Weitergabe',
      body: 'Standard-WordPress-Themes laden Google Fonts von Google-Servern. Das überträgt die IP-Adresse des Besuchers an Google (USA) ohne Einwilligung. Seit LG München I (Az. 3 O 17493/20) ein bekanntes Abmahnmuster.',
    },
    {
      Icon: RefreshCw,
      title: 'Cookie-Banner funktioniert — aber nicht mehr nach dem letzten Update',
      body: 'Borlabs Cookie, Real Cookie Banner, DSGVO Cookie Compliance — viele Banner-Plugins werden durch Theme-Updates oder Konflikte mit anderen Plugins deaktiviert oder falsch konfiguriert. Sieht funktional aus, blockiert aber nichts mehr.',
    },
  ],
  checksTitle: 'Was wir an WordPress-Seiten konkret prüfen',
  checks: [
    {
      title: 'Plugin-Inventar + Tracker-Erkennung',
      body: 'Vollständige Liste aller geladenen Tracker, Skripte und Cookies — vor und nach Consent-Klick. Mit Angabe welcher Plugin oder welches Theme den Tracker einbindet. Inklusive Bewertung: kritisch / warnung / ok.',
    },
    {
      title: 'Google Fonts, YouTube-Embeds, externe Ressourcen',
      body: 'Automatische Erkennung aller extern geladenen Ressourcen mit Drittland-Status. Empfehlung: Self-Hosting-Anleitung für Google Fonts, Embed-Wrapper für YouTube, Lite YouTube Plugin-Hinweis.',
    },
    {
      title: 'Consent-Banner Effektivitäts-Test',
      body: 'Wir prüfen, ob Ihr Cookie-Banner wirklich alle Tracker blockiert — oder ob technische Cookies ohne Einwilligung gesetzt werden. Test vor Consent-Klick, nach Ablehnen und nach Akzeptieren.',
    },
  ],
  faqTitle: 'Häufige Fragen zu WordPress & DSGVO',
  faqs: [
    {
      q: 'Welche WordPress-Plugins sind DSGVO-sicher?',
      a: 'Es gibt keine generell „DSGVO-sicheren" Plugins — es hängt davon ab, wie sie konfiguriert sind und welche Consent-Lösung Sie einsetzen. Wir prüfen den konkreten Zustand Ihrer Installation, nicht pauschale Plugin-Bewertungen.',
    },
    {
      q: 'Brauchen wir ein spezielles DSGVO-Plugin?',
      a: 'Ein Consent-Banner ist notwendig, wenn Sie Drittanbieter-Cookies oder externe Tracker nutzen. Wir prüfen, ob Ihr bestehender Banner korrekt funktioniert — und geben eine Empfehlung, falls nicht.',
    },
    {
      q: 'Müssen wir bei WordPress-Hosting in Deutschland hosten?',
      a: 'Hosting-Standort ist ein Faktor, aber nicht der einzige. Auch bei deutschem Hosting können externe Tools (Google Analytics, Facebook Pixel) Drittland-Transfers auslösen. Wir prüfen den kompletten Datenfluss.',
    },
    {
      q: 'Wie oft sollten wir unsere WordPress-Website prüfen?',
      a: 'Nach jedem Plugin-Update und jedem Theme-Wechsel — also in der Praxis: kontinuierlich. Unser Monitoring übernimmt das automatisch und alarmiert bei Compliance-Drift.',
    },
  ],
};

export function WordpressDsgvoLanding() {
  return <NicheLanding config={CONFIG} />;
}
