import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle } from 'lucide-react';

/**
 * Datenschutzerklärung — Mustertext.
 *
 * WICHTIG: Diese Mustertexte ersetzen KEINE individuelle anwaltliche Prüfung.
 * Vor Live-Schaltung in Produktion bitte durch DSGVO-Berater oder Anwalt
 * prüfen lassen. Dies ist ein Skelett, das die wesentlichen Pflicht-Sektionen
 * (Art. 13/14 DSGVO) abdeckt.
 */
export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Datenschutzerklärung</div>
            <div className="text-[11px] text-titanium-400 font-medium">Stand {new Date().toISOString().slice(0, 10)}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-titanium-300 text-sm leading-relaxed">
        {import.meta.env.DEV && (
          <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-900 rounded-none text-xs">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="text-amber-200">
              <strong>Status: Pre-Launch.</strong> Verantwortlicher (Name, Anschrift) und Aufsichtsbehörde (TLfDI) sind eingetragen.
              Mustertext-Skelett — vor Produktiv-Einsatz durch DSGVO-Berater oder Anwalt prüfen lassen, insbesondere zur
              Anpassung an konkrete Verarbeitungsprozesse.
            </span>
          </div>
        )}

        <Section title="1. Verantwortlicher (Art. 4 Nr. 7 DSGVO)">
          <p>
            <strong className="text-titanium-50">RealSync Dynamics</strong><br />
            Schwarzburger Str. 31<br />
            98724 Neuhaus am Rennweg<br />
            Thüringen, Deutschland
          </p>
          <p>
            E-Mail: <a className="text-security-400" href="mailto:privacy@realsyncdynamicsai.de">privacy@realsyncdynamicsai.de</a><br />
            Inhaber / Vertretungsberechtigt: <strong className="text-titanium-50">Dominik Steiner</strong>
          </p>
        </Section>

        <Section title="2. Datenschutzbeauftragter">
          <p>
            Falls bestellungspflichtig nach § 38 BDSG: Kontaktdaten des DSB
            hier ergänzen. Andernfalls: <em>„Ein Datenschutzbeauftragter ist
            gesetzlich nicht vorgeschrieben; Anfragen richten Sie bitte an
            die unter Ziffer 1 genannte Adresse."</em>
          </p>
        </Section>

        <Section title="3. Welche Daten wir verarbeiten">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Account-Daten:</strong> E-Mail, optional Name, Workspace-Zugehörigkeit (Tenant + Rolle).</li>
            <li><strong>Nutzungsdaten:</strong> AI-Tool-Aufrufe (Prompt-Inhalt, Output, Token-Counts, Kosten), Workflow-Ausführungen, Asset-Metadaten.</li>
            <li><strong>Zahlungsdaten:</strong> über Stripe; wir speichern Customer-ID und Subscription-Status — keine Karten-/IBAN-Daten.</li>
            <li><strong>Technische Daten:</strong> IP-Adresse (kurzzeitig in Server-Logs), User-Agent, Login-Zeitpunkt.</li>
          </ul>
        </Section>

        <Section title="4. Rechtsgrundlagen (Art. 6 DSGVO)">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Art. 6 Abs. 1 lit. b</strong> — Vertragserfüllung: Account-, Subscription-, Workspace-Daten.</li>
            <li><strong>Art. 6 Abs. 1 lit. f</strong> — Berechtigtes Interesse: technische Logs zur Sicherheit, Audit-Trail, Cost-Tracking.</li>
            <li><strong>Art. 6 Abs. 1 lit. a</strong> — Einwilligung: Cookie-Banner für nicht-notwendige Cookies, Marketing-Mails.</li>
            <li><strong>Art. 6 Abs. 1 lit. c</strong> — Rechtliche Pflicht: handels- und steuerrechtliche Aufbewahrung von Rechnungen (10 Jahre, HGB/AO).</li>
          </ul>
        </Section>

        <Section title="5. Empfänger der Daten / Sub-Prozessoren">
          <p>
            Wir setzen Auftragsverarbeiter nach Art. 28 DSGVO ein. Die vollständige
            Liste mit Zwecken, Regionen und AVV/DPA-Links findest Du auf
            der <Link to="/legal/sub-processors" className="text-security-400">Sub-Prozessoren-Seite</Link>.
          </p>
          <p>
            Wesentliche Empfänger: Supabase (Frankfurt), Anthropic / Google / OpenAI
            (USA, mit EU-DPA + SCCs nach Art. 46 DSGVO), Stripe (Irland), Hostinger
            (Deutschland).
          </p>
        </Section>

        <Section title="6. Datenresidenz / EU-lokal-Modus">
          <p>
            Standardmäßig laufen AI-Aufrufe über die o. g. Cloud-Anbieter. Mit dem
            Schalter „EU-lokal" in Deinen Account-Einstellungen
            (<Link to="/settings/ai-residency" className="text-security-400">/settings/ai-residency</Link>)
            kannst Du erzwingen, dass <strong>alle</strong> AI-Anfragen Deines
            Accounts ausschließlich auf unserem deutschen VPS verarbeitet werden.
            In diesem Modus verlassen Daten die EU nicht.
          </p>
          <p>
            Workspace-Owner können die Wahl per <em>tenant.ai_data_residency_policy</em>
            für alle Mitglieder erzwingen.
          </p>
        </Section>

        <Section title="7. Speicherdauer">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Account-Daten: bis Account-Löschung.</li>
            <li>Audit-Logs (AI-Tool-Calls, Workflow-Runs): bis Account-Löschung; danach anonymisiert für Cost-Tracking.</li>
            <li>Rechnungen / Subscriptions: 10 Jahre nach § 257 HGB / § 147 AO.</li>
            <li>Magic-Link-E-Mails: nicht persistiert.</li>
          </ul>
        </Section>

        <Section title="8. Deine Rechte">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Art. 15</strong> Auskunftsrecht — Selfservice-Export unter <Link to="/settings/account" className="text-security-400">/settings/account</Link>.</li>
            <li><strong>Art. 16</strong> Recht auf Berichtigung — direkt im Profil.</li>
            <li><strong>Art. 17</strong> Recht auf Löschung — Selfservice-Löschung unter /settings/account.</li>
            <li><strong>Art. 20</strong> Datenübertragbarkeit — der Export liefert maschinenlesbares JSON.</li>
            <li><strong>Art. 21</strong> Widerspruchsrecht gegen Verarbeitung auf Grundlage berechtigter Interessen.</li>
            <li><strong>Art. 77</strong> Beschwerderecht bei der zuständigen Aufsichtsbehörde — für uns:
              <strong className="text-titanium-50"> Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit (TLfDI)</strong>,
              Häßlerstraße 8, 99096 Erfurt, <a className="text-security-400" href="mailto:poststelle@datenschutz.thueringen.de">poststelle@datenschutz.thueringen.de</a>.
            </li>
          </ul>
          <p>
            Anfragen die nicht im Selfservice abgedeckt sind:
            <a className="text-security-400" href="mailto:privacy@realsyncdynamicsai.de"> privacy@realsyncdynamicsai.de</a>
          </p>
        </Section>

        <Section title="9. Cookies">
          <p>
            Wir setzen technisch notwendige Cookies (Session-Cookie für Login,
            keine Einwilligung erforderlich nach § 25 Abs. 2 TTDSG). Tracking-,
            Marketing- und Statistik-Cookies setzen wir nur nach expliziter
            Einwilligung über das Cookie-Banner ein.
          </p>
        </Section>

        <Section title="10. Tracking-Pixel & Marketing-Cookies (Detail)">
          <p>
            Mit Deiner Einwilligung über das Cookie-Banner setzen wir folgende
            Tracking-Pixel ein. Rechtsgrundlage ist in allen Fällen Art. 6 Abs. 1
            lit. a DSGVO (Einwilligung) i. V. m. § 25 Abs. 1 TTDSG. Du kannst die
            Einwilligung jederzeit über das Cookie-Banner widerrufen.
          </p>
          <p className="text-xs text-titanium-500">
            Hinweis Drittstaat-Transfer (Schrems II): Die unten genannten Anbieter
            mit Sitz in den USA verarbeiten Daten teilweise in den USA. Wir stützen
            den Transfer auf EU-Standardvertragsklauseln (SCCs, Art. 46 Abs. 2 lit. c
            DSGVO) sowie auf die Angemessenheitsentscheidung im Rahmen des
            EU-US Data Privacy Framework, soweit der Anbieter zertifiziert ist.
          </p>
          <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-obsidian-950 text-[10px] font-bold text-titanium-400 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-2 py-2">Pixel</th>
                  <th className="text-left px-2 py-2">Empfänger / Drittstaat</th>
                  <th className="text-left px-2 py-2 hidden md:table-cell">Zweck</th>
                  <th className="text-left px-2 py-2">Speicherdauer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-titanium-900 text-titanium-300">
                <tr>
                  <td className="px-2 py-2 align-top">
                    <div className="font-bold text-titanium-50">Meta Pixel</div>
                    <div className="text-[10px] text-titanium-500">fbevents.js</div>
                  </td>
                  <td className="px-2 py-2 align-top">Meta Platforms Ireland Ltd. (EU) / Meta Platforms, Inc. (USA) — SCCs + DPF</td>
                  <td className="px-2 py-2 align-top hidden md:table-cell">Conversion-Tracking, Re-Marketing, Audience-Aufbau für Werbeanzeigen auf Facebook / Instagram</td>
                  <td className="px-2 py-2 align-top">bis zu 180 Tage (Meta-Cookies)</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 align-top">
                    <div className="font-bold text-titanium-50">TikTok Pixel</div>
                    <div className="text-[10px] text-titanium-500">tiktok.com/pixel</div>
                  </td>
                  <td className="px-2 py-2 align-top">TikTok Information Technologies UK Ltd. / TikTok Inc. (USA) — SCCs</td>
                  <td className="px-2 py-2 align-top hidden md:table-cell">Conversion-Tracking und Re-Marketing für Werbeanzeigen auf TikTok</td>
                  <td className="px-2 py-2 align-top">bis zu 13 Monate</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 align-top">
                    <div className="font-bold text-titanium-50">Google Analytics 4</div>
                    <div className="text-[10px] text-titanium-500">gtag.js / GA4</div>
                  </td>
                  <td className="px-2 py-2 align-top">Google Ireland Ltd. (EU) / Google LLC (USA) — SCCs + DPF; IP-Anonymisierung aktiv</td>
                  <td className="px-2 py-2 align-top hidden md:table-cell">Reichweitenmessung und Nutzungsanalyse (anonymisiert)</td>
                  <td className="px-2 py-2 align-top">bis zu 14 Monate (Default-Retention)</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 align-top">
                    <div className="font-bold text-titanium-50">Google Ads</div>
                    <div className="text-[10px] text-titanium-500">gtag.js / AW</div>
                  </td>
                  <td className="px-2 py-2 align-top">Google Ireland Ltd. (EU) / Google LLC (USA) — SCCs + DPF</td>
                  <td className="px-2 py-2 align-top hidden md:table-cell">Conversion-Tracking und Re-Marketing für Werbeanzeigen im Google-Netzwerk</td>
                  <td className="px-2 py-2 align-top">bis zu 540 Tage</td>
                </tr>
                <tr>
                  <td className="px-2 py-2 align-top">
                    <div className="font-bold text-titanium-50">LinkedIn Insight Tag</div>
                    <div className="text-[10px] text-titanium-500">snap.licdn.com</div>
                  </td>
                  <td className="px-2 py-2 align-top">LinkedIn Ireland Unlimited Company (EU) / LinkedIn Corporation (USA) — SCCs + DPF</td>
                  <td className="px-2 py-2 align-top hidden md:table-cell">Conversion-Tracking und Audience-Aufbau für B2B-Werbeanzeigen auf LinkedIn</td>
                  <td className="px-2 py-2 align-top">bis zu 180 Tage</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-titanium-500">
            Konkrete Cookie-Namen und technische Parameter pro Anbieter findest Du in
            der Cookie-Übersicht des jeweiligen Anbieters; verlinkt ist
            jeder Anbieter unter <Link to="/legal/sub-processors" className="text-security-400">Sub-Prozessoren</Link>.
          </p>
        </Section>

        <Section title="11. Änderungen">
          <p>
            Wir passen diese Datenschutzerklärung an, wenn sich die rechtliche
            Grundlage oder unsere Verarbeitungstätigkeiten ändern. Wesentliche
            Änderungen werden registrierten Nutzern per E-Mail avisiert.
          </p>
        </Section>

        <div className="flex flex-wrap items-center gap-4 text-xs text-titanium-400 pt-6 border-t border-titanium-900">
          <Link to="/legal/sub-processors" className="hover:text-titanium-200">Sub-Prozessoren</Link>
          <Link to="/settings/account" className="hover:text-titanium-200">Mein Account</Link>
          <a href="mailto:privacy@realsyncdynamicsai.de" className="hover:text-titanium-200">privacy@realsyncdynamicsai.de</a>
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
