import { Calendar, ShieldAlert, Plug } from 'lucide-react';
import { NicheLanding, type NicheConfig } from './NicheLanding';

const CONFIG: NicheConfig = {
  segment: 'Arztpraxis',
  sourceTag: 'arztpraxen',
  eyebrow: 'Für Arzt-, Zahnarzt- & Therapiepraxen',
  headline: 'Ihre Praxis-Website hat heute wahrscheinlich ein DSGVO-Problem. Finden Sie es in 30 Sekunden.',
  subline:
    'Online-Terminbuchung, Kontaktformulare, Google Fonts — und ein Webdesigner, der „DSGVO-konform" versichert hat. Doch jedes Plugin-Update, jede WordPress-Aktualisierung kann den Compliance-Status kippen. Wir prüfen Ihre Website automatisch auf Patientendaten-Risiken und alarmieren Sie bei Änderungen — bevor ein Anwalt Sie anschreibt.',
  primaryCtaHref: '/audit?source=arztpraxen',
  primaryCtaLabel: 'Praxis-Website jetzt kostenlos prüfen',
  painCards: [
    {
      Icon: Calendar,
      title: 'Terminbuchung lädt Tracking-Cookies vor Einwilligung',
      body: 'Doctolib-, Jameda-, Calendly- und Ähnliches laden oft tracking-pflichtige Cookies bevor der Patient auf „Akzeptieren" geklickt hat. Patientendaten fließen dabei in Drittländer (USA, Frankreich) ohne explizite Aufklärung.',
    },
    {
      Icon: ShieldAlert,
      title: 'Kontaktformular = Patientenakte-Light ohne Verschlüsselung',
      body: 'Symptome, Medikamente, Allergien — Patienten schreiben alles ins Kontaktformular. Landen diese Daten unverschlüsselt im Webhoster-Postfach, verletzt das Art. 9 DSGVO (besondere Kategorie) mit Bußgeldrisiko bis 20 Mio. €.',
    },
    {
      Icon: Plug,
      title: 'Webdesigner hat Google Fonts aktiviert — IP-Übermittlung läuft',
      body: 'Seit LG München I (Az. 3 O 17493/20) ist das externe Laden von Google Fonts ohne Einwilligung abmahnbar. Betrifft nahezu jede WordPress-Praxis-Website mit Standard-Theme.',
    },
  ],
  checksTitle: 'Was wir konkret für Arztpraxen prüfen',
  checks: [
    {
      title: 'Terminbuchungs-Tools + Drittland-Status',
      body: 'Doctolib, Jameda, Termin-im-Netz, Calendly — wir prüfen, welche Cookies vor Consent gesetzt werden, wo der Provider hostet und ob Ihre Datenschutzerklärung den Embed korrekt beschreibt. Ausgabe: Klarer Befund mit Handlungsempfehlung für Ihren Webdesigner.',
    },
    {
      title: 'Kontaktformular + Art. 9 DSGVO',
      body: 'Verschlüsselung der Übertragung, Storage-Provider, Empfänger-Postfach, Einwilligungstext. Art. 9 (besondere Kategorien personenbezogener Daten) verlangt ausdrückliche Einwilligung — wir prüfen, ob die Voraussetzungen bei Ihnen erfüllt sind.',
    },
    {
      title: 'Plugin-Audit + Google Fonts + YouTube-Embeds',
      body: 'WordPress/Webflow-Plugins, externe Schriften, eingebettete Videos. Mit Klartext-Empfehlung: Was muss raus, was muss self-hosted werden, was braucht einen Consent-Wrapper — direkt nutzbar für Ihr Gespräch mit dem Webdesigner.',
    },
  ],
  faqTitle: 'Häufige Fragen von Praxen',
  faqs: [
    {
      q: 'Müssen wir Doctolib jetzt abschalten?',
      a: 'Nein. Sie brauchen einen sauberen Consent-Banner, der Doctolib erst nach Einwilligung lädt, plus einen korrekten Eintrag in Ihrer Datenschutzerklärung und einen AVV mit Doctolib (meist vorhanden). Wir prüfen, ob der Setup bei Ihnen funktioniert — und liefern konkrete Korrektur-Hinweise.',
    },
    {
      q: 'Unser Webdesigner sagt, alles ist DSGVO-konform. Brauchen wir den Audit trotzdem?',
      a: 'Webdesigner sind keine Datenschutzbeauftragten. Wir liefern den maschinellen technischen Befund mit Zeitstempel. Wenn alles passt: prima. Wenn nicht, hat Ihr Webdesigner einen konkreten Punkte-Plan — keine Diskussion, nur Fakten.',
    },
    {
      q: 'Müssen wir Patienten über den Audit informieren?',
      a: 'Nein. Wir prüfen ausschließlich Ihre öffentlich zugängliche Website von außen. Kein Zugriff auf Praxisverwaltungs-Software, Patientenakten oder interne Systeme.',
    },
    {
      q: 'Was kostet das Monitoring nach dem kostenlosen Erstaudit?',
      a: 'Der Erstaudit ist kostenlos. Kontinuierliches Monitoring mit wöchentlichen Re-Audits und Sofort-Alert bei Drift startet im Monitoring-Plan. Genaue Preise sobald die Stripe-Anbindung live ist — auf der Warteliste werden Sie als Erste informiert.',
    },
  ],
};

export function ArztpraxenLanding() {
  return <NicheLanding config={CONFIG} />;
}
