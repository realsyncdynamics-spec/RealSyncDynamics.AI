import { Scale, FolderArchive, History } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const CONFIG: NicheConfig = {
  segment: 'Kanzlei',
  sourceTag: 'kanzleien',
  eyebrow: 'Für Rechtsanwaltskanzleien & Notariate',
  headline: 'DSGVO-Compliance für Kanzleien — mit lückenlosem Nachweis statt Hoffnung.',
  subline:
    'Kanzleien kaufen keine Software. Kanzleien kaufen Nachweise, Historien und Audit-Trails. RealSyncDynamics.AI überwacht Ihre Kanzlei-Website kontinuierlich, dokumentiert jeden Compliance-Status und erzeugt kryptographisch gesicherte Evidence-Records — für den Fall, dass die Aufsichtsbehörde fragt.',
  primaryCtaHref: '/audit?source=kanzleien',
  primaryCtaLabel: 'Kanzlei-Website jetzt prüfen',
  painCards: [
    {
      Icon: Scale,
      title: 'Mandanten-Kontaktformular = sensible Daten ohne Schutz',
      body: 'Rechtsanfragen enthalten Sachverhalte, Vertragsdetails, Personendaten. Landen diese in einem unverschlüsselten Postfach beim Webhoster, ist Art. 5 Abs. 1 lit. f DSGVO (Integrität & Vertraulichkeit) verletzt — mit Haftungsrisiko für die Kanzlei.',
    },
    {
      Icon: History,
      title: 'Compliance verfällt still — und niemand merkt es',
      body: 'Nach einem Theme-Update, einem neuen Plugin oder einem Google-Fonts-Wechsel können Tracker vor Consent laden. Der Verstoß entsteht im Hintergrund. Ohne kontinuierliches Monitoring gibt es keinen Frühwarnindikator.',
    },
    {
      Icon: FolderArchive,
      title: 'Aufsichtsbehörde fragt — und Sie haben keine Dokumentation',
      body: 'Die Behörde erwartet nicht nur aktuelle Compliance, sondern Nachweise über vergangene Zustände. Ohne Evidence-Trail lautet die Antwort: „Wir meinen, es war immer korrekt." Das überzeugt Prüfer nicht.',
    },
  ],
  checksTitle: 'Was wir konkret für Kanzleien prüfen',
  checks: [
    {
      title: 'Kanzlei-Website: Kontaktformular, Newsletter, Analytics',
      body: 'Kontaktformular-Verschlüsselung, Newsletter-Dienstleister (Mailchimp / CleverReach / HubSpot), Google Analytics / Matomo, Calendly-Terminbuchung — mit Rechtsgrundlagen-Bewertung und konkreter Empfehlung.',
    },
    {
      title: 'Evidence-Vault: kryptographischer Compliance-Nachweis',
      body: 'Jeder Prüfdurchlauf erzeugt einen signierten Befund mit Timestamp. Der Evidence-Vault speichert alle Compliance-Zustände chronologisch — für Aufsichtsbehörden, Zertifizierungen und interne Dokumentationspflichten.',
    },
    {
      title: 'Kontinuierliches Monitoring + Drift-Alert',
      body: 'Sofort-Alert per E-Mail wenn sich Ihr Compliance-Status ändert: neuer Tracker erkannt, Cookie-Banner deaktiviert, Drittland-Transfer hinzugekommen. Keine manuelle Prüfung mehr notwendig.',
    },
  ],
  faqTitle: 'Häufige Fragen von Kanzleien',
  faqs: [
    {
      q: 'Ist der Audit nach DSGVO Art. 5 als Nachweis anerkannt?',
      a: 'Unser technischer Befund dokumentiert den Zustand der Website zum Prüfzeitpunkt mit Timestamp und digitaler Signatur. Als rechtliche Aussage über die vollständige DSGVO-Konformität kann er nicht dienen — aber als technische Grundlage für Ihren DSB oder Ihren Fachanwalt ist er ein erheblich stärkeres Instrument als mündliche Zusicherungen.',
    },
    {
      q: 'Greift der Audit auf Mandantendaten oder Kanzlei-interne Systeme zu?',
      a: 'Nein. Wir prüfen ausschließlich Ihre öffentlich zugängliche Website von außen. Kein Zugriff auf Kanzleisoftware, Aktenmanagement, Postfächer oder interne Netzwerke.',
    },
    {
      q: 'Was passiert, wenn sich nach einem Website-Update die Compliance ändert?',
      a: 'Das Monitoring erkennt Drift automatisch — z. B. wenn nach einem Plugin-Update ein Tracker vor Consent lädt. Sie erhalten sofort eine Benachrichtigung mit konkretem Befund und Empfehlung.',
    },
    {
      q: 'Können wir den Service für Mandanten-Websites nutzen?',
      a: 'Ja. Kanzleien, die ihren Mandanten DSGVO-Compliance als Service anbieten wollen, können über das Business-/Enterprise-Paket mehrere Domains monitoren. White-Label-Reports auf Anfrage verfügbar.',
    },
  ],
};

export function KanzleienLanding() {
  return <NicheLanding config={CONFIG} />;
}
