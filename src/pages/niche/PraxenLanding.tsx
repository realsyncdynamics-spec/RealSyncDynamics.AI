import { Stethoscope, FileLock2, Calendar } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const PRAXEN_CONFIG: NicheConfig = {
  segment: 'Praxis',
  eyebrow: 'Für Arzt-, Zahnarzt-, Therapie-Praxen',
  headline: 'DSGVO + Patientendaten-Schutz für Praxis-Websites — versteckte Risiken sichtbar machen.',
  subline:
    'Online-Terminbuchung, Kontaktformulare, Plugin-Wildwuchs. Wir scannen Ihre Praxis-Website auf Patientendaten-Risiken — von Doctolib-Embeds bis Google-Fonts-IP-Übermittlung. Verständlicher Befund-Report für Sie und Ihren Webdesigner.',
  primaryCtaHref: '/audit?source=fuer-praxen',
  painCards: [
    {
      Icon: Calendar,
      title: 'Online-Termine ohne saubere Einwilligung',
      body: 'Doctolib-, Jameda-, Calendly-Embeds laden oft tracking-pflichtige Cookies vor Consent. Patientendaten fließen in Drittland (USA / Frankreich-Sub-Processors) ohne klare Aufklärung.',
    },
    {
      Icon: FileLock2,
      title: 'Kontaktformular = Patientenakte-Light',
      body: 'Beschwerde, Symptome, Allergien werden im Kontaktformular gesendet — landen aber in unverschlüsseltem Mail-Postfach beim Webhoster. Art. 9 DSGVO (besondere Kategorie) wird häufig verletzt.',
    },
    {
      Icon: Stethoscope,
      title: 'Webdesigner-Plugins ungefiltert',
      body: 'Google Fonts vom Webdesigner-Standard, „Cookie-Banner light" der nur akzeptiert, alte WordPress-Plugins. Die häufigste Quelle für Abmahnungen lokaler Anwaltskanzleien.',
    },
  ],
  checksTitle: 'Was wir konkret für Praxen prüfen',
  checks: [
    {
      title: 'Buchungstools + Drittland-Status',
      body: 'Doctolib, Jameda, Termin-im-Netz — wir prüfen, welche Cookies vor Consent gesetzt werden, wo der Provider hostet und ob Ihre DSE den Embed korrekt nennt.',
    },
    {
      title: 'Formulare + Art. 9 DSGVO',
      body: 'Kontakt-Forms, Anamnese-Bögen — wir checken Verschlüsselung, Storage-Provider, Empfänger-Postfach und Aufklärungs-Text. Art. 9 (besondere Kategorie) braucht ausdrückliche Einwilligung.',
    },
    {
      title: 'Plugin- + Google-Fonts-Audit',
      body: 'WordPress/Webflow-Plugins, externe Schriften, eingebettete YouTube-Videos. Mit Klartext-Empfehlung für Ihren Webdesigner — was raus, was bleibt, was self-hosted muss.',
    },
  ],
  faqs: [
    {
      q: 'Müssen wir Doctolib jetzt abschalten?',
      a: 'Nein. Sie brauchen einen sauberen Consent-Banner vor Doctolib-Embed-Loading + Eintrag in Ihrer Datenschutzerklärung + AVV mit Doctolib (vorhanden). Wir prüfen, ob der Setup bei Ihnen sauber ist.',
    },
    {
      q: 'Unser Webdesigner sagt, alles ist DSGVO-konform. Brauchen wir den Audit trotzdem?',
      a: 'Webdesigner sind keine Datenschutz-Beauftragten. Wir liefern den maschinellen technischen Befund — wenn alles passt, super; wenn nicht, hat Ihr Webdesigner einen konkreten Punkte-Plan.',
    },
    {
      q: 'Müssen wir Patienten über den Audit informieren?',
      a: 'Nein. Wir prüfen ausschließlich Ihre öffentliche Website von außen. Kein Zugriff auf Praxisverwaltungs-Software, kein Zugriff auf Patientenakten.',
    },
  ],
};

export function PraxenLanding() {
  return <NicheLanding config={PRAXEN_CONFIG} />;
}
