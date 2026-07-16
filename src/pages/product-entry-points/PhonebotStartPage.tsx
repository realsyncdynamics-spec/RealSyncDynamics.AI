import { Link } from 'react-router-dom';
import { SEOHead } from '../../components/SEOHead';
import { Snowflake, ArrowRight, ArrowLeft, Phone } from 'lucide-react';

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

export function PhonebotStartPage() {
  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead />

      <header className="absolute top-0 left-0 right-0 z-30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="w-6 h-6 text-cyan-400" strokeWidth={1.5} />
            <span className="text-lg font-semibold tracking-tight">
              RealSync <span className="font-normal text-white/90">Dynamics.AI</span>
            </span>
          </Link>
        </div>
      </header>

      <section className="min-h-screen flex items-center justify-center px-6 lg:px-10 pt-24">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-6">
              <Phone className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" strokeWidth={1.5} />
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4 sm:mb-6">
              KI-Telefon-Assistent
            </h1>

            <p className="text-base sm:text-lg text-white/70 leading-relaxed max-w-xl mx-auto mb-8 sm:mb-10">
              Sprachanrufe annehmen, verstehen und bearbeiten — mit einer intelligenten KI, die Ihre Policies einhält. EU-gehostet, vollständig dokumentiert, DSGVO- und AI-Act-konform.
            </p>

            <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 sm:p-8 mb-8 sm:mb-10">
              <h3 className="text-lg font-semibold mb-4 text-white/90">Einsatzbeispiele</h3>
              <ul className="space-y-2.5 text-left text-sm sm:text-base text-white/70">
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span>Kundenservice-Hotline — automatisiert, aber mit Human Handoff</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span>Terminvergabe und Reservierungen ohne Wartezeit</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span>FAQ-Automatisierung für häufige Anfragen</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span>Compliance-konforme Datenabfrage (sichere Speicherung)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-cyan-400 font-bold">✓</span>
                  <span>Jedes Gespräch geloggt und auditierbar in der Evidence Vault</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center mb-8">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </Link>
            <button
              onClick={() => alert('Telefon-Assistent wird in der nächsten Phase implementiert.')}
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg"
            >
              Telefon-Assistent einrichten
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <p className="text-center text-xs sm:text-sm text-white/50 font-mono">
            Kostenlos · EU-gehostet · DSGVO & EU AI Act konform
          </p>
        </div>
      </section>
    </div>
  );
}
