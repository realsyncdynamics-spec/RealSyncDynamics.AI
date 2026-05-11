import { usePageMeta } from '../../lib/usePageMeta';
import { useJsonLd, faqPageLd, breadcrumbLd, type FaqEntry } from '../../lib/useJsonLd';
import { SeoPageShell, ProseSection } from './SeoPageShell';
import { AuditCTA } from '../../components/sections/AuditCTA';
import { ComplianceFAQ } from '../../components/sections/ComplianceFAQ';

const FAQS: FaqEntry[] = [
  {
    question: 'Ist Matomo immer ohne Consent erlaubt?',
    answer:
      'Nein. Das hängt von Konfiguration, Zweck und rechtlicher Bewertung ab. Cookieless Matomo mit Self-Hosting, IP-Masking und Datenminimierung kann das Risiko reduzieren; ob im Einzelfall keine Einwilligung erforderlich ist, sollte juristisch geprüft werden.',
  },
  {
    question: 'Was bedeutet cookieless Matomo?',
    answer:
      'Matomo wird ohne Analytics-Cookies betrieben. Tracking kann dennoch stattfinden und muss transparent in der Datenschutzerklärung beschrieben werden — Zweck, Speicherdauer, Opt-out, Drittanbieter.',
  },
  {
    question: 'Was sollte in der Datenschutzerklärung stehen?',
    answer:
      'Zweck der Verarbeitung, Betreiber, Hosting-Standort, IP-Masking, eingesetzte Cookies (oder ausdrücklich: keine), Speicherdauer, Opt-out-Mechanismus, Betroffenenrechte sowie ggf. die Rolle als Auftragsverarbeiter.',
  },
  {
    question: 'Erkennt RealSyncDynamics.AI Matomo?',
    answer:
      'Der Audit kann technische Hinweise auf Matomo-Skripte, Cookies und mögliche Pre-Consent-Indikatoren liefern. Er ersetzt keine vollständige rechtliche Bewertung der konkreten Konfiguration.',
  },
];

const CODE_SNIPPET = `<script>
  var _paq = window._paq = window._paq || [];
  // disableCookies() MUSS vor trackPageView() gesetzt werden,
  // sonst werden Matomo-Cookies trotzdem gesetzt.
  _paq.push(['disableCookies']);
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u = "https://matomo.example.com/";
    _paq.push(['setTrackerUrl', u + 'matomo.php']);
    _paq.push(['setSiteId', '1']);
    var d = document;
    var g = d.createElement('script');
    var s = d.getElementsByTagName('script')[0];
    g.async = true;
    g.src = u + 'matomo.js';
    s.parentNode.insertBefore(g, s);
  })();
</script>`;

export function MatomoDsgvoKonfiguration() {
  usePageMeta({
    title: 'Matomo DSGVO-freundlich konfigurieren — Cookieless Tracking, IP-Anonymisierung & Datenschutz',
    description:
      'Praxisnahe technische Hinweise für Matomo: cookieless Tracking, IP-Masking, Datenminimierung, Opt-out und Datenschutzhinweise.',
    url: 'https://realsyncdynamicsai.de/resources/matomo-dsgvo-konfiguration',
  });
  useJsonLd('jsonld-faq-matomo', faqPageLd(FAQS));
  useJsonLd(
    'jsonld-bc-matomo',
    breadcrumbLd([
      { name: 'Home', url: 'https://realsyncdynamicsai.de/' },
      { name: 'Ressourcen', url: 'https://realsyncdynamicsai.de/resources' },
      { name: 'Matomo DSGVO-freundlich konfigurieren', url: 'https://realsyncdynamicsai.de/resources/matomo-dsgvo-konfiguration' },
    ]),
  );

  return (
    <SeoPageShell
      eyebrow="Ressourcen · Tracking & Analytics"
      h1="Matomo DSGVO-freundlich konfigurieren"
      breadcrumbs={[
        { name: 'Ressourcen', href: '/resources' },
        { name: 'Matomo DSGVO-freundlich konfigurieren' },
      ]}
    >
      <ProseSection>
        <h2 className="font-display font-bold text-titanium-50 text-xl">Warum Matomo?</h2>
        <p>
          Matomo kann datenschutzfreundlich betrieben werden, insbesondere bei Self-Hosting,
          Datenminimierung und restriktiver Konfiguration. Ob ein Einsatz <em>ohne</em> Einwilligung
          zulässig ist, hängt von der konkreten Konfiguration, dem Zweck, den eingesetzten Cookies oder
          Trackern und der rechtlichen Bewertung ab. Cookieless Tracking kann das Risiko reduzieren —
          eine pauschale Aussage „immer ohne Consent erlaubt" wäre falsch.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Empfohlene technische Konfiguration</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Self-Hosting auf EU-Infrastruktur oder EU-gehostete Variante prüfen.</li>
          <li>IP-Masking / IP-Anonymisierung aktivieren (Tracker-Konfiguration „Anonymize Visitors' IPs").</li>
          <li>Analytics-Cookies deaktivieren, wenn möglich (cookieless Tracking).</li>
          <li>Keine User-IDs ohne klare Rechtsgrundlage.</li>
          <li>Visitor Profiles und detaillierte Besucherlogs einschränken.</li>
          <li>Datenaufbewahrung begrenzen — z. B. 6–14 Monate, je nach Zweck.</li>
          <li>Opt-out anbieten (eingebetteter Opt-out-Iframe oder eigene Cookie-Banner-Integration).</li>
          <li>Do-Not-Track respektieren, sofern für den Use-Case sinnvoll.</li>
          <li>Datenschutzerklärung aktualisieren und Matomo transparent dokumentieren.</li>
        </ul>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Cookieless Tracking — Code-Beispiel</h2>
        <p>
          Beispielhafter Embed-Code, der Cookies vor dem ersten Pageview deaktiviert. Wichtig:
          <code className="text-titanium-100"> disableCookies </code> muss <em>vor</em>
          <code className="text-titanium-100"> trackPageView </code> gesetzt werden — sonst werden die
          Matomo-Cookies trotz Konfiguration einmal gesetzt.
        </p>
        <pre className="bg-obsidian-900 border border-silver-700/30 p-4 overflow-x-auto text-[12px] leading-relaxed text-silver-200">
          <code>{CODE_SNIPPET}</code>
        </pre>
        <p className="text-sm text-silver-400">
          Die konkrete URL und Site-ID müssen durch die eigene Matomo-Instanz ersetzt werden.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Consent-Hinweis</h2>
        <p>
          Cookieless Matomo kann das Risiko reduzieren. Ob keine Einwilligung erforderlich ist, hängt von der
          konkreten Umsetzung und Rechtslage ab. Sobald Cookies, User-IDs, Profilbildung oder zusätzliche
          Tracking-Technologien genutzt werden, sollte Matomo erst nach Einwilligung geladen werden — der
          Einsatz vor Consent kann als Pre-Consent Tracking gewertet werden.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Datenschutzerklärung — Beispieltext</h2>
        <p className="text-silver-300">
          Wir setzen die Web-Analytik-Software Matomo (Self-Hosted, EU-Hosting) ein. Matomo läuft mit
          IP-Masking und ohne Analytics-Cookies. Verarbeitet werden lediglich anonymisierte Nutzungsdaten zu
          statistischen Zwecken. Eine Übermittlung an Dritte findet nicht statt. Sie können der Verarbeitung
          jederzeit über den unter „Cookies & Tracking" verlinkten Opt-out widersprechen.
        </p>
        <p className="text-sm text-yellow-300">
          Bitte juristisch prüfen lassen — dies ist eine Mustervorlage, kein rechtssicherer Text.
        </p>

        <h2 className="font-display font-bold text-titanium-50 text-xl">Wie RealSyncDynamics.AI dabei hilft</h2>
        <p>
          Der Audit kann technische Hinweise auf Analytics- und Tracking-Setups, Drittanbieter-Skripte,
          Cookie-Verhalten und mögliche Pre-Consent-Risiken liefern. Erkannte Matomo-Bausteine werden mit
          einem Hinweis dokumentiert, der die wichtigsten Konfigurations-Punkte adressiert. Der Audit
          ersetzt keine vollständige rechtliche Bewertung.
        </p>
      </ProseSection>

      <AuditCTA source="seo-matomo-dsgvo" />

      <ComplianceFAQ entries={FAQS} title="Matomo DSGVO — Fragen & Antworten" />
    </SeoPageShell>
  );
}
