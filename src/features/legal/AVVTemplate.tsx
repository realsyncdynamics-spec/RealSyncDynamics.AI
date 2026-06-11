import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Printer, Download, Mail } from 'lucide-react';

/**
 * AVV/DPA-Template gemäß Art. 28 DSGVO. Wird auf /legal/avv ausgeliefert.
 * Inhalt ist eine ausgefüllte Vorlage, die Kunden als Print/PDF nutzen können —
 * "RealSync Dynamics" ist als Auftragsverarbeiter eingetragen, der Kunde
 * trägt sich als Verantwortlicher ein.
 */
export function AVVTemplate() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 print:hidden">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <FileText className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">AVV-Template</div>
            <div className="text-[11px] text-titanium-400 font-medium">DSGVO Art. 28 · Auftragsverarbeitung</div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-titanium-800 hover:border-security-500 text-titanium-300 hover:text-titanium-50 rounded-none"
          >
            <Printer className="h-3.5 w-3.5" /> Drucken / als PDF speichern
          </button>
          <a
            href="mailto:support@realsyncdynamicsai.de?subject=AVV%20unterzeichnen"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-security-500 hover:bg-security-600 text-white rounded-none"
          >
            <Mail className="h-3.5 w-3.5" /> AVV anfragen
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 sm:px-8 py-10 print:py-0 print:px-0 print:max-w-none">
        <div className="bg-obsidian-900 border border-titanium-900 print:bg-white print:border-0 print:text-[#1a1f2b] p-8 sm:p-12 print:p-12 leading-relaxed">

          <div className="border-b border-titanium-800 print:border-titanium-300 pb-6 mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-titanium-500 mb-2">Vorlage · Stand 2026</p>
            <h1 className="font-display text-3xl font-bold text-titanium-50 print:text-[#0d1117] mb-3">
              Auftragsverarbeitungs-Vereinbarung (AVV)
            </h1>
            <p className="text-sm text-titanium-400 print:text-[#5a6470]">
              gemäß Art. 28 Abs. 3 DSGVO zwischen Verantwortlichem und Auftragsverarbeiter
            </p>
          </div>

          {/* Parteien */}
          <Section title="§ 1 — Parteien">
            <p className="mb-3"><strong>Verantwortlicher:</strong></p>
            <div className="border border-titanium-800 print:border-titanium-300 p-3 mb-4 text-sm font-mono">
              <div>Firma: ______________________________________</div>
              <div>Adresse: _____________________________________</div>
              <div>vertreten durch: _____________________________</div>
              <div>(„<em>Kunde</em>")</div>
            </div>
            <p className="mb-3"><strong>Auftragsverarbeiter:</strong></p>
            <div className="border border-titanium-800 print:border-titanium-300 p-3 text-sm">
              RealSync Dynamics<br />
              Inhaber: Dominik Seed<br />
              Anschrift: <em>[wird durch RealSync ausgefüllt]</em><br />
              E-Mail: <a href="mailto:privacy@realsyncdynamicsai.de" className="text-security-400 print:text-[#1f6feb]">privacy@realsyncdynamicsai.de</a><br />
              („<em>RealSync</em>")
            </div>
          </Section>

          {/* Gegenstand */}
          <Section title="§ 2 — Gegenstand, Dauer und Zweck">
            <Para>
              <strong>(1)</strong> Gegenstand der Vereinbarung ist die Verarbeitung personenbezogener Daten durch RealSync im Rahmen der vom Kunden beauftragten SaaS-Leistungen (KI-Workflows, Audit-Log, DSGVO-Selfservice) gemäß Hauptvertrag.
            </Para>
            <Para>
              <strong>(2)</strong> Die Vereinbarung gilt für die Dauer des Hauptvertrags. Sie endet automatisch mit dessen Beendigung.
            </Para>
            <Para>
              <strong>(3)</strong> Zweck der Datenverarbeitung ist die Erbringung der vertraglich vereinbarten Leistungen. RealSync verarbeitet Daten ausschließlich auf dokumentierte Weisung des Kunden.
            </Para>
          </Section>

          {/* Art der Daten */}
          <Section title="§ 3 — Art der personenbezogenen Daten und Kategorien betroffener Personen">
            <Para>
              <strong>(1) Datenkategorien:</strong> Stammdaten (Name, E-Mail), Nutzungsdaten (Login-Zeitpunkte, Aktionsprotokolle), Inhaltsdaten der vom Kunden hochgeladenen oder über die API verarbeiteten Texte/Dokumente, Abrechnungsdaten.
            </Para>
            <Para>
              <strong>(2) Betroffene Personen:</strong> Mitarbeiter und Kunden des Kunden, die die Plattform nutzen oder deren Daten über die Plattform verarbeitet werden.
            </Para>
            <Para>
              <strong>(3)</strong> Die Verarbeitung besonderer Kategorien personenbezogener Daten (Art. 9 DSGVO) bedarf der vorherigen schriftlichen Einzelgenehmigung durch RealSync.
            </Para>
          </Section>

          {/* Pflichten Verarbeiter */}
          <Section title="§ 4 — Pflichten von RealSync">
            <Para>RealSync verpflichtet sich:</Para>
            <ol className="list-decimal pl-6 space-y-2 my-3">
              <li>Daten nur auf dokumentierte Weisung des Kunden zu verarbeiten;</li>
              <li>alle eingesetzten Personen zur Vertraulichkeit zu verpflichten;</li>
              <li>geeignete technische und organisatorische Maßnahmen (TOM, Anhang 1) umzusetzen;</li>
              <li>den Kunden bei Erfüllung der Rechte betroffener Personen (Art. 15-22 DSGVO) zu unterstützen;</li>
              <li>Datenschutzverletzungen unverzüglich, spätestens binnen 24 Stunden, an den Kunden zu melden (Art. 33 DSGVO);</li>
              <li>nach Vertragsende sämtliche personenbezogenen Daten zu löschen oder zurückzugeben (Wahl des Kunden), spätestens nach 30 Tagen, sofern keine gesetzliche Aufbewahrungspflicht entgegensteht.</li>
            </ol>
          </Section>

          {/* Subunternehmer */}
          <Section title="§ 5 — Sub-Auftragsverarbeiter">
            <Para>
              <strong>(1)</strong> Der Kunde stimmt zu, dass RealSync die in der öffentlichen Sub-Prozessoren-Liste (
              <Link to="/legal/sub-processors" className="text-security-400 print:text-[#1f6feb]">/legal/sub-processors</Link>
              ) genannten Unterauftragsverarbeiter einsetzen darf.
            </Para>
            <Para>
              <strong>(2)</strong> Vor Beauftragung neuer oder Wechsel bestehender Sub-Prozessoren wird der Kunde mindestens 30 Tage im Voraus informiert. Der Kunde kann bei begründeten Bedenken widersprechen und in diesem Fall den Hauptvertrag außerordentlich kündigen.
            </Para>
            <Para>
              <strong>(3)</strong> RealSync schließt mit jedem Sub-Prozessor einen DSGVO-konformen Vertrag mit gleichwertigen Schutzpflichten.
            </Para>
          </Section>

          {/* Drittlandtransfer */}
          <Section title="§ 6 — Drittlandtransfer / EU-Datenresidenz">
            <Para>
              <strong>(1)</strong> RealSync betreibt Server primär innerhalb der Europäischen Union. Der Kunde kann pro Tenant erzwingen, dass alle KI-Aufrufe ausschließlich auf EU-Servern verarbeitet werden („eu_local" Modus).
            </Para>
            <Para>
              <strong>(2)</strong> Bei Nutzung externer KI-Anbieter (Anthropic, Google, OpenAI) erfolgt der Transfer in die USA auf Basis der EU-Standardvertragsklauseln 2021/914 sowie unter Berücksichtigung der EuGH-Schrems-II-Anforderungen (zusätzliche Maßnahmen gemäß EDSA Recommendations 01/2020).
            </Para>
          </Section>

          {/* Auskunft / Löschung */}
          <Section title="§ 7 — Rechte betroffener Personen">
            <Para>
              <strong>(1)</strong> Wendet sich eine betroffene Person mit einem Anliegen nach Art. 15-22 DSGVO unmittelbar an RealSync, leitet RealSync die Anfrage unverzüglich an den Kunden weiter.
            </Para>
            <Para>
              <strong>(2)</strong> RealSync stellt dem Kunden eine API zur Verfügung, mit der Auskunfts- (Art. 15) und Löschanfragen (Art. 17) automatisiert beantwortet werden können (
              <code className="bg-obsidian-950 print:bg-titanium-100 px-1.5 py-0.5 text-xs">/functions/v1/gdpr-export</code> · <code className="bg-obsidian-950 print:bg-titanium-100 px-1.5 py-0.5 text-xs">/functions/v1/gdpr-delete</code>
              ).
            </Para>
          </Section>

          {/* Kontroll- und Auditrechte */}
          <Section title="§ 8 — Kontroll- und Auditrechte">
            <Para>
              <strong>(1)</strong> Der Kunde hat das Recht, die Einhaltung dieser Vereinbarung beim Auftragsverarbeiter zu überprüfen oder durch beauftragte Dritte überprüfen zu lassen, jeweils nach mindestens 14 Tagen Vorankündigung.
            </Para>
            <Para>
              <strong>(2)</strong> RealSync legt auf Anfrage Audit-Berichte (z.B. Pen-Tests, ISO-Zertifikate sofern vorhanden, Sub-Prozessoren-Liste) vor.
            </Para>
          </Section>

          {/* Haftung */}
          <Section title="§ 9 — Haftung">
            <Para>
              Die Haftung richtet sich nach Art. 82 DSGVO sowie den Bestimmungen des Hauptvertrags. RealSync haftet nicht für Schäden, die durch nicht dokumentierte Weisungen des Kunden entstehen.
            </Para>
          </Section>

          {/* Schluss */}
          <Section title="§ 10 — Schlussbestimmungen">
            <Para>
              <strong>(1)</strong> Es gilt deutsches Recht. Gerichtsstand ist der Sitz von RealSync.
            </Para>
            <Para>
              <strong>(2)</strong> Änderungen und Ergänzungen bedürfen der Schriftform. Sollte eine Bestimmung unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.
            </Para>
          </Section>

          {/* Anhang TOM */}
          <Section title="Anhang 1 — Technische und organisatorische Maßnahmen (TOM)">
            <h3 className="font-display font-bold text-titanium-50 print:text-[#0d1117] text-base mt-4 mb-2">Vertraulichkeit (Art. 32 Abs. 1 lit. b DSGVO)</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-sm">
              <li>Zutritt: Hosting in zertifizierten Rechenzentren in der EU (Frankfurt am Main).</li>
              <li>Zugang: Magic-Link-Authentifizierung, Multi-Factor-Authentication für Admin-Accounts.</li>
              <li>Zugriff: Row-Level Security (RLS) auf Datenbankebene, granulare Rollen (Owner / Admin / Operator / Viewer).</li>
              <li>Verschlüsselung: TLS 1.3 für alle Verbindungen, AES-256 für Daten at rest.</li>
              <li>Pseudonymisierung: IP-Hashing in Lead-Capture und Audit-Logs.</li>
            </ul>

            <h3 className="font-display font-bold text-titanium-50 print:text-[#0d1117] text-base mt-4 mb-2">Integrität (Art. 32 Abs. 1 lit. b DSGVO)</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-sm">
              <li>Append-only Audit-Log für alle Datenmutationen.</li>
              <li>Prüfsummen für gespeicherte Dateien.</li>
              <li>Versionierung in der Datenbank.</li>
            </ul>

            <h3 className="font-display font-bold text-titanium-50 print:text-[#0d1117] text-base mt-4 mb-2">Verfügbarkeit (Art. 32 Abs. 1 lit. b DSGVO)</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-sm">
              <li>Tägliche Backups, Point-in-Time-Recovery.</li>
              <li>Geo-redundante Backup-Speicherung innerhalb der EU.</li>
              <li>Monitoring + Alerting für kritische Komponenten.</li>
            </ul>

            <h3 className="font-display font-bold text-titanium-50 print:text-[#0d1117] text-base mt-4 mb-2">Belastbarkeit + Wiederherstellbarkeit (Art. 32 Abs. 1 lit. c DSGVO)</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-sm">
              <li>Recovery Time Objective (RTO): 24 Stunden.</li>
              <li>Recovery Point Objective (RPO): 1 Stunde.</li>
              <li>Disaster-Recovery-Plan jährlich getestet.</li>
            </ul>

            <h3 className="font-display font-bold text-titanium-50 print:text-[#0d1117] text-base mt-4 mb-2">Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d DSGVO)</h3>
            <ul className="list-disc pl-6 space-y-1.5 text-sm">
              <li>Quartalsweise interne Sicherheits-Reviews.</li>
              <li>Vulnerability-Scanning auf allen Produktivsystemen.</li>
              <li>Mitarbeiter-Schulungen zum Datenschutz mindestens jährlich.</li>
            </ul>
          </Section>

          {/* Unterschriften */}
          <Section title="Unterschriften">
            <div className="grid sm:grid-cols-2 gap-8 mt-6">
              <div>
                <p className="text-sm mb-12">Verantwortlicher (Kunde)</p>
                <div className="border-t border-titanium-700 print:border-[#1a1f2b] pt-2 text-xs text-titanium-500 print:text-[#5a6470]">
                  Ort, Datum, Unterschrift
                </div>
              </div>
              <div>
                <p className="text-sm mb-12">Auftragsverarbeiter (RealSync)</p>
                <div className="border-t border-titanium-700 print:border-[#1a1f2b] pt-2 text-xs text-titanium-500 print:text-[#5a6470]">
                  Ort, Datum, Unterschrift
                </div>
              </div>
            </div>
          </Section>

          <div className="mt-10 pt-6 border-t border-titanium-900 print:border-titanium-300 text-xs text-titanium-500 print:text-[#7a838e]">
            Diese Vorlage ist eine grundlegende Version, kein Ersatz für individuelle Rechtsberatung. Anpassungen an branchenspezifische Anforderungen (z.B. § 203 StGB für Anwaltskanzleien, BAIT/MaRisk für Banken, § 113c SGB XI für Pflege) erforderlich. RealSync stellt auf Wunsch ein angepasstes Dokument zur Unterzeichnung bereit.
          </div>
        </div>

        <div className="mt-6 print:hidden text-center">
          <Link
            to="/contact-sales?source=avv"
            className="inline-flex items-center gap-2 px-5 py-3 bg-security-500 hover:bg-security-600 text-white font-bold rounded-none"
          >
            Branchen-spezifische AVV anfragen <Download className="h-4 w-4" />
          </Link>
        </div>
      </main>

      <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-8 print:hidden">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between gap-3 text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics</div>
          <div className="flex flex-wrap gap-4">
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>
            <Link to="/legal/compliance-matrix" className="hover:text-titanium-300">Compliance-Matrix</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-display text-lg font-bold text-titanium-50 print:text-[#0d1117] mb-3">{title}</h2>
      <div className="text-sm text-titanium-300 print:text-[#2c3340]">{children}</div>
    </section>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="mb-3">{children}</p>;
}
