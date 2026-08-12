import { Building2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { BranchenLanding, Section, UseCaseGrid } from './branchen/BranchenLanding';

/**
 * Zielgruppen-Landingpage: Website + Chat-Bot + Telefon-Assistent für kleine
 * Betriebe (Handwerk, Praxen, Kanzleien, Büros).
 *
 * Bewusst getrennt von der Governance-Hauptseite: andere Zielgruppe, andere
 * Ansprache, anderer Preispunkt. Verlinkt wird von MainLanding aus.
 *
 * Ehrlichkeitsregel (CLAUDE.md §14): Die Seite bewirbt kein fertiges
 * Self-Service-Produkt. Der Einstieg läuft über ein Erstgespräch
 * (/contact-sales) — kein Checkout, der ins Leere führt.
 */
export function KmuWebsiteLanding() {
  return (
    <BranchenLanding
      config={{
        headerTitle: 'Website & Assistenten für kleine Betriebe',
        Icon: Building2,
        iconGradient: 'bg-gradient-to-br from-security-500 to-blue-700',
        badgeClass: 'border-security-900 bg-security-950/30 text-security-300',
        badgeText: 'Handwerk · Praxen · Kanzleien · Büros',
        headline: (
          <>
            Ihre Website nimmt Anrufe entgegen —{' '}
            <span className="text-security-400">auch wenn Sie auf der Baustelle sind</span>.
          </>
        ),
        subline: (
          <>
            Eine gepflegte Website, ein Chat-Assistent für Anfragen und ein Telefon-Assistent,
            der Termine annimmt, statt sie in der Mailbox verhungern zu lassen.
            <strong className="text-titanium-50"> DSGVO-konform, gehostet in der EU.</strong>
          </>
        ),
        cta: {
          heading: 'Erstgespräch: 20 Minuten, unverbindlich.',
          sub: 'Wir schauen uns Ihre aktuelle Seite an und sagen ehrlich, ob sich der Aufwand für Sie lohnt.',
          buttons: [
            { to: '/contact-sales?source=kmu-website', label: 'Erstgespräch vereinbaren', variant: 'primary' },
            { to: '/audit', label: 'Kostenloser DSGVO-Scan Ihrer Seite', variant: 'secondary' },
            { to: '/pricing', label: 'Preise ansehen', variant: 'ghost' },
          ],
        },
        jsonLd: {
          headline: 'Website mit Chat- und Telefon-Assistent für kleine Betriebe',
          description:
            'Website, Chat-Assistent und telefonische Terminannahme für Handwerk, Praxen und Kanzleien. DSGVO-konform, EU-Hosting.',
          datePublished: '2026-08-12',
        },
      }}
    >
      <Section title="Das Problem">
        <p>
          Sie sind auf der Baustelle, am Patienten oder im Mandantengespräch — und das Telefon
          klingelt. Wer nicht rangeht, verliert den Auftrag an den Betrieb, der rangegangen ist.
        </p>
        <p>Was kleine Betriebe im Alltag ausbremst:</p>
        <ul className="space-y-1.5 mt-3 text-sm">
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Anrufe während der Arbeit — die Mailbox nimmt keine Termine an
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Website von 2016, nicht mobiltauglich, ohne funktionierendes Kontaktformular
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Cookie-Banner und Datenschutzerklärung nie geprüft — Abmahnrisiko
          </li>
          <li className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Abends noch Anfragen abarbeiten, weil tagsüber keine Zeit war
          </li>
        </ul>
      </Section>

      <Section title="Was Sie bekommen">
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Website mit Ihren Daten</strong> — Leistungen,
              Öffnungszeiten, Anfahrt, Kontakt. Auf dem Handy genauso lesbar wie am Rechner
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Chat-Assistent</strong> — beantwortet
              Standardfragen zu Leistungen und Zeiten und nimmt Anfragen strukturiert auf
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Telefon-Assistent</strong> — geht ran, wenn Sie
              nicht können, nimmt Anliegen und Rückrufwunsch auf
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Ihre eigene Domain</strong> — die Seite läuft
              unter Ihrer Adresse, mit gültigem SSL-Zertifikat
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">DSGVO-Grundlagen erledigt</strong> — Cookie-Banner,
              Datenschutzerklärung und Impressum, Hosting in der EU
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-titanium-50">Nachvollziehbar</strong> — jedes Gespräch der
              Assistenten ist protokolliert und für Sie einsehbar
            </span>
          </li>
        </ul>
      </Section>

      <Section title="Für wen sich das rechnet">
        <UseCaseGrid
          items={[
            { t: 'Handwerksbetrieb', d: 'Anrufe von der Baustelle aus verpasst — der Assistent nimmt Anliegen und Rückrufwunsch auf, Sie melden sich abends gesammelt zurück' },
            { t: 'Arzt- und Zahnarztpraxis', d: 'Terminanfragen und Standardfragen zu Sprechzeiten laufen über den Assistenten, die Anmeldung wird spürbar entlastet' },
            { t: 'Kanzlei', d: 'Erstkontakt strukturiert aufnehmen: Anliegen, Rechtsgebiet, Dringlichkeit — vorqualifiziert statt Zettelwirtschaft' },
            { t: 'Physio, Kosmetik, Friseur', d: 'Terminwünsche außerhalb der Öffnungszeiten annehmen, statt sie an den Wettbewerb zu verlieren' },
            { t: 'Kleines Büro ohne Empfang', d: 'Ein Assistent statt Anrufbeantworter — Anrufer bekommen eine Antwort statt eines Tonbands' },
            { t: 'Betrieb mit veralteter Website', d: 'Neue Seite auf Basis Ihrer bestehenden Inhalte, ohne dass Sie alles neu formulieren müssen' },
          ]}
        />
      </Section>

      <Section title="Wie es abläuft">
        <ul className="space-y-1.5 text-sm">
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <strong className="text-titanium-50">Erstgespräch, 20 Minuten</strong> — wir sehen uns
            Ihre jetzige Seite an und sagen ehrlich, ob sich der Aufwand lohnt
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Sie liefern Ihre Stammdaten: Leistungen, Zeiten, Logo, Kontakt
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Wir richten Website und Assistenten ein und stimmen die Antworten mit Ihnen ab
          </li>
          <li className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            Freischaltung auf Ihrer Domain — vorher sehen Sie alles in einer Vorschau
          </li>
        </ul>
        <p className="mt-4 text-sm text-titanium-300">
          Das Angebot wird gerade mit den ersten Betrieben aufgebaut. Wer früh dabei ist,
          bestimmt mit, welche Funktionen zuerst kommen — sprechen Sie uns an.
        </p>
      </Section>
    </BranchenLanding>
  );
}
