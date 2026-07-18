import { Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader, CardBody } from '../../enterprise-os/components/Card';

export function ApiDocumentation() {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/app/settings/api-keys"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
            API einfach erklärt
          </div>
          <div className="text-[11px] text-titanium-400 font-medium">
            Anfänger-Dokumentation · Keine Programmier-Kenntnisse nötig
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Section 1: Was ist ein API-Key? */}
        <Card>
          <CardHeader
            eyebrow="Grundlagen"
            title="Was ist ein API-Key?"
            subtitle="Der sicherste Weg, Systeme zu verbinden"
          />
          <CardBody className="space-y-4">
            <div>
              <h4 className="font-semibold text-titanium-100 mb-2">Die einfache Erklärung:</h4>
              <p className="text-sm text-titanium-300 leading-relaxed">
                Ein API-Key ist wie ein Verbindungsschlüssel zwischen zwei Systemen. Wenn du RealSyncDynamics.AI
                mit deinem Chatbot, deiner Website oder deinem CRM verbinden möchtest, brauchst du diesen Schlüssel.
              </p>
            </div>

            <div className="bg-obsidian-900 border border-titanium-800 rounded-none p-4">
              <p className="text-xs font-mono uppercase tracking-[0.1em] text-titanium-500 mb-2">Beispiel:</p>
              <p className="text-sm text-titanium-300">
                Dein Chatbot will eine Compliance-Prüfung durchführen. Er sendet deinen API-Key mit zur Anfrage.
                RealSyncDynamics.AI sagt: „Ah, das ist aus Tenant XYZ. Ich vertrau dir." Und gibt die Ergebnisse zurück.
              </p>
            </div>

            <p className="text-sm text-titanium-400">
              <strong className="text-titanium-200">Sicherheit:</strong> Der Schlüssel ist wie ein Passwort — nur
              du hast ihn, und wir speichern nicht mal das Original. Falls jemand ihn findet, kannst du ihn sofort
              widerrufen.
            </p>
          </CardBody>
        </Card>

        {/* Section 2: Wann brauchst du einen API-Key? */}
        <Card>
          <CardHeader
            eyebrow="Praktisch"
            title="Wann brauchst du einen API-Key?"
            subtitle="Häufige Szenarien"
          />
          <CardBody className="space-y-3">
            {[
              {
                title: 'Dein Chatbot oder Bot soll automatisch Compliance-Checks machen',
                example: 'z.B. bei jeder neuen FAQ-Antwort prüfen: Ist das DSGVO-konform?',
              },
              {
                title: 'Du möchtest Scans von außen auslösen',
                example: 'z.B. via Make, Zapier, oder deinen eigenen Python-Script',
              },
              {
                title: 'Du willst ein Dashboard bauen, das Ergebnisse von RealSync zeigt',
                example: 'z.B. auf deiner Website ein „Compliance Status"-Widget',
              },
              {
                title: 'Du automatisierst Dokumentation',
                example: 'z.B. täglich Reports generieren, ohne die App zu öffnen',
              },
            ].map((item, i) => (
              <div key={i} className="bg-obsidian-900 border border-titanium-800 rounded-none p-3">
                <p className="text-sm font-semibold text-titanium-100">{item.title}</p>
                <p className="text-xs text-titanium-400 mt-1">{item.example}</p>
              </div>
            ))}

            <div className="border-t border-titanium-800 pt-4 mt-4">
              <p className="text-sm text-titanium-400">
                <strong className="text-titanium-200">Keine dieser Szenarien?</strong> Dann brauchst du keinen API-Key.
                RealSyncDynamics.AI funktioniert auch ohne Programmierung — völlig übers Dashboard.
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Section 3: Wie erstelle ich einen API-Key? */}
        <Card>
          <CardHeader
            eyebrow="How-To"
            title="Wie erstelle ich einen API-Key?"
            subtitle="Schritt für Schritt"
          />
          <CardBody className="space-y-4">
            {[
              {
                step: '1',
                title: 'Gehe zu API-Keys',
                desc: 'Öffne deine Settings → API-Keys',
              },
              {
                step: '2',
                title: 'Klicke „API-Key generieren"',
                desc: 'Ein Wizard führt dich durch 5 einfache Fragen',
              },
              {
                step: '3',
                title: 'Beantworte die Fragen',
                desc: 'Wofür? Welche Berechtigungen? Wie heißt der Key?',
              },
              {
                step: '4',
                title: 'Schlüssel sicher kopieren',
                desc: 'Der Key wird NUR EINMAL angezeigt — speichere ihn sofort!',
              },
              {
                step: '5',
                title: 'In dein System einfügen',
                desc: 'Nutze die Code-Beispiele aus der Dokumentation',
              },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-security-600 flex items-center justify-center font-bold text-white text-sm">
                    {item.step}
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <p className="font-semibold text-titanium-100 text-sm">{item.title}</p>
                  <p className="text-sm text-titanium-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}

            <Link
              to="/app/api/setup"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-security-600 hover:bg-security-500 text-white rounded-none text-sm font-bold transition-colors"
            >
              Zum Wizard →
            </Link>
          </CardBody>
        </Card>

        {/* Section 4: FAQs */}
        <Card>
          <CardHeader
            eyebrow="Questions?"
            title="Häufig gestellte Fragen"
            subtitle="Anfänger-FAQ"
          />
          <CardBody className="space-y-2">
            {[
              {
                q: 'Was passiert, wenn ich meinen API-Key verliere?',
                a: 'Keine Panik! Du kannst ihn sofort widerrufen (sperren) und einen neuen erstellen. Der alte funktioniert danach nicht mehr.',
              },
              {
                q: 'Wie sicher ist mein API-Key?',
                a: 'Sehr sicher. Wir speichern nur einen verschlüsselten Hash, nicht den Key selbst. Selbst wir können den Schlüssel nicht wiederherstellen. Behandle ihn wie ein Passwort.',
              },
              {
                q: 'Kann ich mehrere API-Keys haben?',
                a: 'Ja! Du kannst beliebig viele Keys erstellen — einen für deinen Chatbot, einen für Make, einen für die CI/CD-Pipeline. So ist jeder isoliert.',
              },
              {
                q: 'Was sind "Scopes" / "Berechtigungen"?',
                a: 'Das sind Regeln, was ein API-Key darf. „Read-only" bedeutet: nur Daten abrufen. „Write" bedeutet: auch Scans starten. So gibst du nur die Mindest-Berechtigungen.',
              },
              {
                q: 'Kostet ein API-Key extra?',
                a: 'Nein. API-Zugriff ist in Agency-Plan und höher enthalten. Im Starter- oder Growth-Plan ist es nicht verfügbar.',
              },
              {
                q: 'Wie viele API-Aufrufe darf ich machen?',
                a: 'Das hängt von deinem Plan ab. Im Agency-Plan sind 10.000 Aufrufe/Monat enthalten. Wenn du mehr brauchst, upgrade auf Enterprise oder Partner — oder kontaktiere uns.',
              },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => setExpandedFaq(expandedFaq === i.toString() ? null : i.toString())}
                className="w-full text-left bg-obsidian-900 border border-titanium-800 rounded-none p-3 hover:border-titanium-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 shrink-0 mt-0.5 text-security-500" />
                  <div className="flex-1">
                    <p className="font-semibold text-titanium-100 text-sm">{item.q}</p>
                    {expandedFaq === i.toString() && (
                      <p className="text-sm text-titanium-400 mt-2">{item.a}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </CardBody>
        </Card>

        {/* Section 5: Für Entwickler */}
        <Card>
          <CardHeader
            eyebrow="Advanced"
            title="Für Entwickler & Techniker"
            subtitle="Code-Beispiele & Referenzen"
          />
          <CardBody className="space-y-4">
            <p className="text-sm text-titanium-300">
              Falls du selbst entwickelst oder einen Entwickler beauftragst:
            </p>

            <div className="bg-obsidian-950 border border-titanium-700 rounded-none p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
              <div className="text-titanium-500 mb-2"># API-Key im Authorization-Header verwenden</div>
              <div className="mb-3">
                curl -X GET https://api.realsync.de/v1/scans \<br />
                &nbsp;&nbsp;-H &quot;Authorization: Bearer rsd_your_key_here&quot;
              </div>

              <div className="text-titanium-500 mb-2 mt-4"># oder im Header x-rsd-tenant-key</div>
              <div>
                curl -X POST https://api.realsync.de/v1/scans/start \<br />
                &nbsp;&nbsp;-H &quot;x-rsd-tenant-key: rsd_your_key_here&quot; \<br />
                &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
                &nbsp;&nbsp;-d {`'{"url":"https://example.de"}'`}
              </div>
            </div>

            <p className="text-sm text-titanium-400">
              <strong className="text-titanium-200">Vollständige API-Referenz:</strong>{' '}
              <a
                href="/api/docs"
                className="text-security-400 hover:text-security-300 inline-flex items-center gap-1"
              >
                /api/docs <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </CardBody>
        </Card>

        {/* Footer */}
        <div className="flex gap-3 pb-8">
          <Link to="/app/settings/api-keys" className="px-3 py-2 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 rounded-none text-sm font-semibold">
            ← Zurück zu Verwaltung
          </Link>
        </div>
      </main>
    </div>
  );
}
