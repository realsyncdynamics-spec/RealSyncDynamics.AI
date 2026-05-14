import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Globe, Mail, Clock,
  ShieldCheck, FileText, Sparkles,
} from 'lucide-react';

/**
 * /dsgvo-website/danke — Confirmation-Page nach erfolgreichem Stripe-Checkout
 * für den DSGVO-Website-Rebuild-Tier.
 *
 * URL: /dsgvo-website/danke?session_id=cs_...
 *
 * Was hier passiert:
 *   - Kunde ist gerade von Stripe redirected, Zahlung ist bestätigt.
 *   - stripe-webhook hat (asynchron, ~1-3s nach Stripe-Confirm) bereits
 *     den website_rebuilds-Job mit status='queued' angelegt und
 *     rebuild-website Edge-Function via waitUntil getriggert.
 *   - Der 8-Step-Workflow läuft im Hintergrund (typisch 30-90s).
 *   - Diese Page kommuniziert: "Wir haben deine Bezahlung, Workflow läuft,
 *     du bekommst eine E-Mail mit dem Preview-Link."
 *
 * Bewusst KEINE Live-Status-Polling — Customer ist Cold-Lead ohne Auth,
 * RLS auf website_rebuilds erlaubt keinen anonymen SELECT. Email-basiertes
 * Notify ist der einfachere & verlässlichere Pfad.
 */
export function DsgvoWebsiteDanke() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-fuchsia-600 to-amber-600 flex items-center justify-center">
            <Globe className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
            DSGVO-Website-as-a-Service
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-20">
        <div className="max-w-2xl mx-auto space-y-10">

          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 mb-6 bg-emerald-950/40 border border-emerald-800 rounded-none">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-emerald-900 bg-emerald-950/30 text-emerald-300 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
              <Sparkles className="h-3 w-3" /> Bezahlung bestätigt · Rebuild läuft
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              Danke — wir bauen Ihre Website jetzt DSGVO-konform neu auf.
            </h1>
            <p className="text-base sm:text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
              Ihr Auftrag ist bestätigt. Der DSGVO-Rebuild-Workflow läuft im Hintergrund — typische Dauer
              bis zur ersten Preview: <strong className="text-titanium-100">30 bis 90 Sekunden</strong>.
            </p>
          </div>

          <section className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-7">
            <h2 className="font-display font-bold text-titanium-50 text-lg mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-brass-400" />
              Was als nächstes passiert
            </h2>
            <ol className="space-y-3 text-sm">
              <Step
                num={1}
                title="Scrape & Audit"
                body="Wir laden Ihre aktuelle Homepage und identifizieren alle DSGVO/TTDSG-kritischen Drittanbieter-Embeds, Tracker und Header-Lücken."
              />
              <Step
                num={2}
                title="Bereinigung"
                body="Tracker werden entfernt, Iframes durch Click-to-Load-Placeholder ersetzt, Google Fonts auf eigenen EU-Server umgestellt."
              />
              <Step
                num={3}
                title="Compliance-Layer"
                body="Cookie-Consent-Banner (opt-in, Default-Deny) und automatisch generierte DSE/Impressum/AVV/TOM werden eingebettet."
              />
              <Step
                num={4}
                title="AI-Ready & Preview"
                body="JSON-LD, llms.txt und ai-info.json werden generiert. Sie bekommen eine E-Mail mit dem Preview-Link sobald alles fertig ist."
              />
            </ol>
          </section>

          <section className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-7">
            <h2 className="font-display font-bold text-titanium-50 text-lg mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-ai-cyan-400" />
              Sie bekommen E-Mails zu folgenden Schritten
            </h2>
            <ul className="space-y-2.5 text-sm">
              <BulletItem>
                <strong className="text-titanium-100">Sofort:</strong> Stripe-Zahlungsbestätigung mit Beleg an die im Checkout angegebene E-Mail-Adresse.
              </BulletItem>
              <BulletItem>
                <strong className="text-titanium-100">Nach ~1-2 Minuten:</strong> Preview-Link mit Vorschau Ihrer DSGVO-konformen Website. Sie können in Ruhe prüfen.
              </BulletItem>
              <BulletItem>
                <strong className="text-titanium-100">Nach Freigabe:</strong> Hosting-Setup, DNS-Anweisungen und Übergabe an unser Managed-Team.
              </BulletItem>
            </ul>
          </section>

          {sessionId && (
            <div className="bg-obsidian-900 border border-titanium-900 p-4 sm:p-5">
              <div className="text-xs text-titanium-500 mb-1 uppercase tracking-wider font-bold">
                Bestell-Referenz
              </div>
              <div className="font-mono text-xs text-titanium-300 break-all select-all">
                {sessionId}
              </div>
              <p className="mt-2 text-xs text-titanium-500">
                Bei Rückfragen bitte diese Referenz angeben.
              </p>
            </div>
          )}

          <section className="bg-gradient-to-br from-amber-950/40 to-obsidian-900 border border-amber-900/60 p-6 sm:p-7">
            <h2 className="font-display font-bold text-titanium-50 text-lg mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              Während Sie warten — was bereits sicher ist
            </h2>
            <ul className="space-y-2 text-sm text-titanium-300">
              <BulletItem>
                Hosting in Deutschland (Hostinger DE / Hetzner Falkenstein) — kein US-Cloud-Default.
              </BulletItem>
              <BulletItem>
                Auftragsverarbeitungsvertrag (AVV nach Art. 28 DSGVO) wird Ihnen automatisch zugestellt.
              </BulletItem>
              <BulletItem>
                Halbjährliche Re-Audits sind im Managed-Tier inklusive — Sie bleiben dauerhaft compliant.
              </BulletItem>
              <BulletItem>
                Voller Source-Code-Export bei Vertragsende. Keine Knebel, keine Lock-in-Effekte.
              </BulletItem>
            </ul>
          </section>

          <section>
            <h2 className="font-display font-bold text-titanium-50 text-lg mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-titanium-400" />
              Wir müssen kurz von Ihnen wissen
            </h2>
            <p className="text-sm text-titanium-400 mb-4 leading-relaxed">
              Damit wir Impressum, Datenschutzerklärung und AVV korrekt mit Ihren Stammdaten generieren können,
              senden wir Ihnen in der Bestätigungs-E-Mail einen Link zu einem 2-Minuten-Formular. Bitte füllen
              Sie es vor der Live-Schaltung aus.
            </p>
            <Link
              to="/contact-sales?source=dsgvo-website-danke"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-titanium-700 hover:border-brass-500 text-titanium-200 text-sm font-semibold rounded-none transition-colors"
            >
              AI Agent kontaktieren <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          <div className="text-center pt-4 border-t border-titanium-900">
            <p className="text-xs text-titanium-500">
              Fragen? Schreiben Sie uns an{' '}
              <a href="mailto:hello@realsyncdynamicsai.de" className="text-brass-400 hover:text-brass-300">
                hello@realsyncdynamicsai.de
              </a>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
}

function Step({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-none bg-brass-950/40 border border-brass-700/60 flex items-center justify-center text-brass-300 text-xs font-mono font-bold">
        {num}
      </span>
      <div>
        <div className="font-semibold text-titanium-100 mb-0.5">{title}</div>
        <div className="text-titanium-400 leading-relaxed">{body}</div>
      </div>
    </li>
  );
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-titanium-300">
      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
      <span>{children}</span>
    </li>
  );
}
