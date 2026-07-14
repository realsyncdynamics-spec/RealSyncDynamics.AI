import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

/**
 * Widerrufsbelehrung für Verbraucher gemäß Art. 246a § 1 Abs. 2 EGBGB
 * i. V. m. den Mustern nach Anlage 1 (Belehrung) und Anlage 2
 * (Widerrufsformular) zum EGBGB.
 *
 * Wird unter /widerruf bzw. /legal/widerruf ausgeliefert und im Checkout
 * sowie in den AGB (§ 12) verlinkt. Enthält den für SaaS/digitale Inhalte
 * zwingenden Hinweis auf das vorzeitige Erlöschen des Widerrufsrechts
 * (§ 356 Abs. 5 BGB).
 */
export function Widerrufsbelehrung() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 print:hidden">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3" aria-label="Zurueck zur Startseite">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="font-display font-bold text-sm tracking-tight text-titanium-50">Widerrufsbelehrung</h1>
            <div className="text-[11px] text-titanium-400 font-medium">Art. 246a § 1 EGBGB · §§ 355, 356 BGB</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        <p className="text-xs text-titanium-500">
          Diese Belehrung gilt für Verbraucher i. S. d. § 13 BGB. Unternehmer
          (§ 14 BGB) haben kein gesetzliches Widerrufsrecht.
        </p>

        <Section title="Widerrufsrecht">
          <p>
            Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen
            diesen Vertrag zu widerrufen.
          </p>
          <p>
            Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des
            Vertragsschlusses.
          </p>
          <p>
            Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
          </p>
          <div className="border border-titanium-800 p-3 my-2 text-sm">
            RealSync Dynamics<br />
            Inhaber: Dominik Steiner<br />
            Schwarzburger Str. 31, 98724 Neuhaus am Rennweg, Thüringen, Deutschland<br />
            Telefon: <a className="text-security-400" href="tel:+4917640132161">+49 176 4013 2161</a><br />
            E-Mail: <a className="text-security-400" href="mailto:hello@realsyncdynamicsai.de">hello@realsyncdynamicsai.de</a>
          </div>
          <p>
            mittels einer eindeutigen Erklärung (z. B. ein mit der Post
            versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen
            Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte
            Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben
            ist.
          </p>
          <p>
            Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die
            Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der
            Widerrufsfrist absenden.
          </p>
        </Section>

        <Section title="Folgen des Widerrufs">
          <p>
            Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen,
            die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen
            vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über
            Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese
            Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der
            ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen
            wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden
            Ihnen wegen dieser Rückzahlung Entgelte berechnet.
          </p>
          <p className="text-xs text-titanium-500">
            Hinweis: RealSync erbringt ausschließlich digitale Dienstleistungen
            (Software-as-a-Service). Es fallen keine Liefer- oder
            Rücksendekosten an.
          </p>
        </Section>

        <Section title="Vorzeitiges Erlöschen des Widerrufsrechts (digitale Inhalte / SaaS)">
          <p>
            Bei einem Vertrag über die Bereitstellung von nicht auf einem
            körperlichen Datenträger befindlichen digitalen Inhalten
            (Software-as-a-Service) erlischt Ihr Widerrufsrecht gemäß
            § 356 Abs. 5 BGB, wenn
          </p>
          <ol className="list-decimal pl-6 space-y-1.5 my-2">
            <li>
              Sie ausdrücklich zugestimmt haben, dass wir mit der Ausführung des
              Vertrags vor Ablauf der Widerrufsfrist beginnen, und
            </li>
            <li>
              Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre
              Zustimmung mit Beginn der Ausführung des Vertrags Ihr
              Widerrufsrecht verlieren.
            </li>
          </ol>
          <p>
            Diese ausdrückliche Zustimmung und Kenntnisbestätigung wird im
            Checkout-Prozess über ein separates Häkchen abgefragt. Solange Sie
            diese Bestätigung nicht erteilt haben oder die Ausführung noch nicht
            begonnen hat, besteht das Widerrufsrecht fort.
          </p>
        </Section>

        <Section title="Muster-Widerrufsformular">
          <p className="text-xs text-titanium-500">
            (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte
            dieses Formular aus und senden Sie es zurück.)
          </p>
          <div className="border border-titanium-800 p-4 my-2 text-sm font-mono space-y-2">
            <p>
              An RealSync Dynamics, Inhaber Dominik Steiner, Schwarzburger
              Str. 31, 98724 Neuhaus am Rennweg, Deutschland,
              E-Mail: hello@realsyncdynamicsai.de:
            </p>
            <p>
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*)
              abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) /
              die Erbringung der folgenden Dienstleistung (*)
            </p>
            <p>______________________________________________</p>
            <p>Bestellt am (*) / erhalten am (*): __________________</p>
            <p>Name des/der Verbraucher(s): ______________________</p>
            <p>Anschrift des/der Verbraucher(s): __________________</p>
            <p>Datum / Unterschrift (nur bei Mitteilung auf Papier): ______</p>
            <p className="text-titanium-500">(*) Unzutreffendes streichen.</p>
          </div>
        </Section>

        <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 pt-6 border-t border-titanium-900 print:hidden">
          <Link to="/legal/terms" className="hover:text-titanium-200">AGB</Link>
          <Link to="/legal/privacy" className="hover:text-titanium-200">Datenschutzerklärung</Link>
          <Link to="/impressum" className="hover:text-titanium-200">Impressum</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-titanium-50 tracking-tight text-base mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
