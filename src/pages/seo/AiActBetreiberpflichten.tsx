import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, ClipboardCheck, Repeat, Scale, ShieldCheck } from 'lucide-react';
import {
  BETREIBER_FAQ,
  BETREIBER_PFLICHTEN,
  RECHTSSTAND,
  SELBSTCHECK_PATH,
} from '../../content/aiActBetreiberpflichten';
import { CTA } from '../../content/runtimeVocab';

/**
 * /ai-act-betreiberpflichten — Fachseite zu Art. 26 KI-VO mit Art.-25-Rollencheck.
 * Inhalte aus src/content/aiActBetreiberpflichten.ts; FAQPage-JSON-LD in src/config/seo.ts.
 */
export function AiActBetreiberpflichten() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" aria-label="Zur Startseite" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">AI Act · Betreiberpflichten</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <article className="max-w-3xl mx-auto space-y-12">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Scale className="h-3 w-3" /> VO (EU) 2024/1689 · Art. 26 · Stand {RECHTSSTAND}
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              AI Act Betreiberpflichten — <span className="text-security-400">Art. 26 als Checkliste</span>
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Wer Hochrisiko-KI im Unternehmen einsetzt, ist Betreiber und hat eigene Pflichten.
              Hier stehen alle zwölf Prüfpunkte, jeweils mit Fundstelle und nächstem Schritt.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <Link to={`${SELBSTCHECK_PATH}?source=betreiberpflichten-hero`} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Selbstcheck starten (5 Min.) <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ai-act-klassifikator?source=betreiberpflichten" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-900 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                Ist mein System hochriskant?
              </Link>
            </div>
          </div>

          <Section title="Neue Fristen nach dem Digital Omnibus">
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { d: '2. Dezember 2027', t: 'Hochrisiko-Systeme nach Anhang III', s: 'z. B. Personalauswahl, Bildung, Kreditwürdigkeit' },
                { d: '2. August 2028', t: 'Hochrisiko-KI in Produkten nach Anhang I', s: 'z. B. Medizinprodukte, Maschinen' },
                { d: 'Gilt bereits', t: 'KI-Kompetenz (Art. 4)', s: 'Maßnahmen zur Förderung der KI-Kompetenz' },
                { d: 'Gilt bereits', t: 'Transparenz (Art. 50)', s: 'u. a. Deepfakes kennzeichnen, Emotionserkennung offenlegen' },
              ].map((p) => (
                <div key={p.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="flex items-baseline gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span className="font-mono text-xs text-amber-300">{p.d}</span>
                  </div>
                  <div className="font-display font-bold text-titanium-50 text-sm">{p.t}</div>
                  <div className="text-xs text-titanium-500 mt-0.5">{p.s}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-titanium-500">
              Grundlage: Verordnung (EU) 2026/1744 (Digital Omnibus), in Kraft seit 27. Juli 2026. Die Pflichten
              wurden verschoben, nicht gestrichen.
            </p>
          </Section>

          <Section title="Wer ist Betreiber?">
            <p>
              Betreiber ist nach Art. 3 Nr. 4 jede natürliche oder juristische Person, Behörde oder Einrichtung, die
              ein KI-System in eigener Verantwortung verwendet. Ausgenommen ist nur die rein persönliche, nicht
              berufliche Nutzung. Ob Sie das System selbst betreiben, als SaaS einkaufen oder über eine API anbinden,
              spielt keine Rolle.
            </p>
            <p>
              Die Pflichten aus Art. 26 gelten für <strong className="text-titanium-50">Hochrisiko-Systeme</strong>.
              Welche Einsätze dazu zählen, regeln Art. 6 und Anhang III. Im Zweifel klären Sie das zuerst mit dem{' '}
              <Link to="/ai-act-klassifikator?source=betreiberpflichten" className="text-security-400 hover:text-security-300">AI-Act-Klassifikator</Link>.
            </p>
          </Section>

          <section aria-labelledby="pflichten">
            <h2 id="pflichten" className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-4">
              Die zwölf Prüfpunkte
            </h2>
            <ol className="space-y-3">
              {BETREIBER_PFLICHTEN.map((p, i) => (
                <li key={p.id} id={p.id} className="p-4 sm:p-5 bg-obsidian-900 border border-titanium-900 rounded-none">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                    <span className="font-mono text-xs text-titanium-500">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="font-display font-bold text-titanium-50 text-base">{p.titel}</h3>
                    <span className="font-mono text-[11px] text-emerald-300">{p.norm}</span>
                  </div>
                  <p className="text-sm text-titanium-300 leading-relaxed">{p.pflicht}</p>
                  <p className="mt-2 text-sm text-titanium-400 leading-relaxed">
                    <span className="font-bold text-titanium-200">Nächster Schritt:</span> {p.massnahme}
                  </p>
                  {p.realsync && (
                    <p className="mt-2 text-xs text-security-300 leading-relaxed">
                      <span className="font-bold">Unterstützung in RealSync:</span> {p.realsync}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="rollenwechsel" className="p-6 sm:p-8 bg-obsidian-900 border border-amber-800 rounded-none">
            <div className="flex items-start gap-3 mb-4">
              <Repeat className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 id="rollenwechsel" className="font-display font-bold text-titanium-50 text-xl mb-1">
                  Vom Betreiber zum Anbieter, ohne es zu merken
                </h2>
                <p className="text-sm text-titanium-400">Art. 25 Abs. 1 KI-VO</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-titanium-300 leading-relaxed">
              <p>
                Der Rollenwechsel passiert selten mit Absicht. Meist ist es ein Projekt, das „nur kurz“ erweitert wurde.
                Sie werden selbst zum Anbieter eines Hochrisiko-Systems, wenn Sie
              </p>
              <ol className="list-decimal pl-5 space-y-1.5">
                <li>es unter Ihrem Namen oder Ihrer Marke in Verkehr bringen oder in Betrieb nehmen, etwa als White-Label-Lösung für Ihre Kunden,</li>
                <li>es wesentlich verändern, etwa durch Feinabstimmung, die Leistung oder Risiken verschiebt,</li>
                <li>ein anderes KI-System so umwidmen, dass es hochriskant wird, etwa einen allgemeinen Chatbot, der plötzlich Bewerbungen vorsortiert.</li>
              </ol>
              <p>
                Dann gelten zusätzlich die Anbieterpflichten nach Art. 16: Risikomanagement, technische Dokumentation,
                Konformitätsbewertung und CE-Kennzeichnung. Ihre Betreiberpflichten bleiben bestehen. Der ursprüngliche
                Anbieter gilt für dieses System nicht mehr als Anbieter, muss aber in der Regel eng mit Ihnen zusammenarbeiten.
              </p>
              <p className="text-titanium-200">
                Halten Sie deshalb für jedes System schriftlich fest, warum Sie Betreiber bleiben. Der Selbstcheck fragt das
                als letzten Punkt ab.
              </p>
            </div>
          </section>

          <Section title="Weitere Regeln im Umfeld von Art. 26">
            <ul className="space-y-2 list-none pl-0">
              <li><strong className="text-titanium-50">Art. 26 Abs. 3:</strong> Andere Pflichten aus EU- und nationalem Recht bleiben bestehen. Wie Sie Ihre Ressourcen für die Aufsicht organisieren, entscheiden Sie selbst.</li>
              <li><strong className="text-titanium-50">Art. 26 Abs. 10:</strong> Nachträgliche biometrische Fernidentifizierung in der Strafverfolgung braucht eine richterliche oder behördliche Genehmigung, beantragt vorab oder spätestens innerhalb von 48 Stunden.</li>
              <li><strong className="text-titanium-50">Art. 26 Abs. 12:</strong> Betreiber arbeiten mit den zuständigen Behörden zusammen.</li>
              <li><strong className="text-titanium-50">Art. 27:</strong> Grundrechte-Folgenabschätzung für öffentliche Stellen, private Erbringer öffentlicher Dienste sowie bei Kreditwürdigkeitsprüfung und Preisbildung in Lebens- und Krankenversicherungen.</li>
              <li><strong className="text-titanium-50">Art. 4:</strong> Maßnahmen zur Förderung der KI-Kompetenz des Personals. Seit dem Digital Omnibus ohne Pflicht zu einem bestimmten Kompetenzniveau.</li>
              <li><strong className="text-titanium-50">Art. 50 Abs. 3 und 4:</strong> Betroffene über Emotionserkennung und biometrische Kategorisierung informieren, Deepfakes kennzeichnen.</li>
              <li><strong className="text-titanium-50">Art. 86:</strong> Recht Betroffener auf Erläuterung, welche Rolle das Hochrisiko-System bei einer sie erheblich beeinträchtigenden Entscheidung gespielt hat.</li>
            </ul>
          </Section>

          <section aria-labelledby="faq">
            <h2 id="faq" className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-4">Häufige Fragen</h2>
            <div className="space-y-3">
              {BETREIBER_FAQ.map((f) => (
                <details key={f.q} className="group bg-obsidian-900 border border-titanium-900 rounded-none">
                  <summary className="cursor-pointer p-4 sm:p-5 list-none flex items-start gap-3">
                    <span className="font-display font-bold text-titanium-50 text-sm sm:text-base flex-1">{f.q}</span>
                    <span className="text-titanium-500 text-xs group-open:hidden mt-1" aria-hidden="true">+</span>
                    <span className="text-titanium-500 text-xs hidden group-open:inline mt-1" aria-hidden="true">−</span>
                  </summary>
                  <p className="px-4 sm:px-5 pb-4 sm:pb-5 -mt-1 text-sm text-titanium-300 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <div className="flex items-start gap-3 mb-4">
              <ClipboardCheck className="h-6 w-6 text-security-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">Wo stehen Sie bei den zwölf Punkten?</h2>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  Der Selbstcheck stellt jede Prüffrage einzeln und erstellt daraus einen Lückenbericht mit nächsten
                  Schritten. Er läuft vollständig im Browser, Ihre Antworten werden nicht übertragen.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to={`${SELBSTCHECK_PATH}?source=betreiberpflichten-footer`} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-security-500 hover:bg-security-600 text-white text-sm font-bold rounded-none">
                Selbstcheck starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/audit?source=betreiberpflichten" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 text-sm font-bold rounded-none">
                {CTA.startGovernanceAudit}
              </Link>
              <Link to="/ai-act-faq" className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none">
                AI-Act-FAQ
              </Link>
            </div>
          </div>

          <p className="text-xs text-titanium-500 leading-relaxed">
            Diese Seite fasst die Verordnung zusammen und ersetzt keine Rechtsberatung. RealSync unterstützt Erfassung,
            Organisation und Nachweis; die rechtliche Bewertung Ihres Einsatzes bleibt bei Ihnen und Ihrer Rechtsberatung.
          </p>
        </article>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
