import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { GovernanceRuntimeDashboard } from "../features/governance/GovernanceRuntimeDashboard";
import { SCAN_CTA } from "../components/landing/LandingShell";
import { StudioStarfield } from "../components/landing/studio/StudioStarfield";
import { usePageMeta } from "../lib/usePageMeta";
import '../styles/governance-runtime-studio.css';

/**
 * /governance-runtime — öffentliche Produktseite der Governance Runtime.
 *
 * Status laut `src/product/implementation-status.ts`: `governance-runtime-core`,
 * `policy-engine`, `ai-gateway`, `evidence-surfaces` = live; laufendes
 * Domain-Monitoring = Beta. Der eingebettete Dashboard-Ausschnitt nutzt
 * ausschließlich Beispieldaten und ist deshalb sichtbar als Demo gekennzeichnet.
 *
 * Gestaltung: Studio-Look wie `/design/landing-studio` (Sternenhimmel, Glas,
 * Neon), Akzente dezent in Blau — Styles in `governance-runtime-studio.css`.
 */
const STEPS: Array<{ k: string; t: string; d: string; beta?: boolean }> = [
  { k: "DISCOVER", t: "Erfassen", d: "Websites, KI-Systeme und Agents als Assets im Inventar." },
  { k: "ASSESS", t: "Bewerten", d: "Risikoklasse nach EU AI Act, Befunde mit DSGVO-Paragraphenbezug." },
  { k: "GOVERN", t: "Richtlinien", d: "Policy Packs und eigene Policies (allow · log_only · warn · block · require_approval). Unbekannte Aktionen werden nur protokolliert, nie hochgestuft." },
  { k: "ENFORCE", t: "Durchsetzen", d: "Policy-Entscheidung je Runtime-Event, Beobachtungsmodus als Standard. Laufendes Monitoring: Beta.", beta: true },
  { k: "EVIDENCE", t: "Nachweisen", d: "Warnungen, Freigaben und Blockaden als Evidence-Einträge, SHA-256-verkettet, EU-Datenhaltung." },
  { k: "AUDIT", t: "Berichten", d: "Prüffähige Berichte und nachvollziehbarer Prüfpfad." },
];

export function GovernanceRuntimePage() {
  usePageMeta({
    title: "Governance Runtime — Risiken, Policies und Nachweise in einer Ebene",
    description:
      "Die Governance Runtime von RealSyncDynamics.AI: Runtime-Events aus KI-Systemen, Websites und Agents gegen Policies prüfen; Warnungen, Freigaben und Blockaden als verkettete Nachweise ablegen. DSGVO & EU AI Act, Datenhaltung in Frankfurt.",
    url: "https://realsyncdynamicsai.de/governance-runtime",
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="grs">
      <div className="grs-sky" aria-hidden="true" />
      <StudioStarfield />
      <a href="#inhalt" className="grs-skip">Zum Inhalt springen</a>

      <div className="grs-wrap">
        <header className={menuOpen ? "grs-nav grs-nav--open" : "grs-nav"}>
          <div className="grs-nav-inner">
            <Link to="/" className="grs-brand" aria-label="RealSync Dynamics & AI – Startseite">
              <span className="grs-mark" aria-hidden="true"><span /><span /></span>
              REALSYNC AI
            </Link>
            <nav className="grs-links" aria-label="Hauptnavigation">
              <Link to="/" onClick={closeMenu}>Startseite</Link>
              <Link to="/governance-runtime" aria-current="page" onClick={closeMenu}>Runtime</Link>
              <Link to="/docs/governance" onClick={closeMenu}>API &amp; Docs</Link>
              <Link to="/pricing" onClick={closeMenu}>Preise</Link>
              <Link to="/welcome" className="grs-links-login" onClick={closeMenu}>Anmelden</Link>
            </nav>
            <Link to="/welcome" className="grs-btn grs-btn--primary grs-nav-cta">
              Login / Register
            </Link>
            <button
              type="button"
              className="grs-burger"
              aria-label="Menü"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ☰
            </button>
          </div>
        </header>

        <main id="inhalt">
          <section className="grs-hero">
            <span className="grs-pill">✦ AI Governance Runtime · Teil des Governance OS</span>
            <h1 className="grs-h1">
              Jede AI-, Web- und Agent-Aktion wird zum <span className="grs-grad">Governance Event.</span>
            </h1>
            <p className="grs-lead">
              Die Runtime nimmt Ereignisse aus Website-Scans, KI-Systemen, Agents und
              SDK entgegen und prüft sie gegen Ihre Policies. Warnungen, Freigaben und
              Blockaden landen als verketteter Nachweis im Evidence Vault — eine
              Governance-Ebene für DSGVO und EU AI Act.
            </p>
            <div className="grs-cta">
              <Link to={SCAN_CTA.replace("landing-scan", "governance-runtime")} className="grs-btn grs-btn--primary">
                Kostenlosen Governance Scan starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/docs/governance" className="grs-btn grs-btn--ghost">
                API-Referenz ansehen →
              </Link>
            </div>
          </section>

          <section aria-label="Ablauf der Governance Runtime" className="grs-card grs-panel">
            <p className="grs-eyebrow">Ablauf</p>
            <h2 className="grs-h2">Vom Ereignis zum Nachweis</h2>
            <p className="grs-sub">Sechs Schritte, ein Prüfpfad — vom Inventar bis zum prüffähigen Bericht.</p>
            <ol className="grs-steps">
              {STEPS.map((s, i) => (
                <li key={s.k} className="grs-step">
                  <span className="grs-num">
                    {String(i + 1).padStart(2, "0")} — {s.k}
                    {s.beta ? <span className="grs-status">BETA</span> : null}
                  </span>
                  <span className="grs-step-title">{s.t}</span>
                  <span className="grs-step-body">{s.d}</span>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Runtime-Ausschnitt (Demo)" className="grs-card grs-panel">
            <p className="grs-eyebrow">Einblick</p>
            <h2 className="grs-h2">So sieht die Runtime aus</h2>
            <p role="note" data-testid="runtime-demo-label" className="grs-note">
              <strong>Demo · Beispieldaten.</strong>{" "}
              Der folgende Ausschnitt zeigt erfundene Assets, Events und Policies zur
              Veranschaulichung — keine Kundendaten, kein Live-Stream. Ihre eigene Runtime
              entsteht nach dem Login aus Ihren Systemen.
            </p>
            <div className="grs-demo">
              <GovernanceRuntimeDashboard />
            </div>
          </section>

          <section className="grs-card grs-final">
            <ShieldCheck className="grs-icon" aria-hidden="true" />
            <h2 className="grs-h2">
              Compliance wird Runtime — <span className="grs-grad">nicht Dokument.</span>
            </h2>
            <p className="grs-sub">
              Starten Sie mit dem kostenlosen Governance Scan Ihrer Domain. Pläne ab
              Starter schalten Evidence Vault, Policy Packs und Prüfpfad frei; für
              Konzern-Setups gibt es Enterprise auf Anfrage.
            </p>
            <div className="grs-cta">
              <Link to={SCAN_CTA.replace("landing-scan", "governance-runtime-footer")} className="grs-btn grs-btn--primary">
                Kostenlosen Governance Scan starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/pricing" className="grs-btn grs-btn--ghost">
                Pläne vergleichen
              </Link>
            </div>
          </section>
        </main>

        <footer className="grs-footer">
          <span>RealSync Dynamics &amp; AI · Governance OS</span>
          <nav aria-label="Rechtliches" style={{ display: "flex", gap: 14 }}>
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
