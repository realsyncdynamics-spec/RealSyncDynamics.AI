import { Link } from 'react-router-dom';
import '../../styles/governance-os-handoff.css';

/** Wortmarke „RealSync Dynamics & AI" — Inter Tight 600 20px, „& AI" im Akzent (Firmenname seit Ummeldung 11/2026). */
export function BrandWordmark({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`rs-wordmark ${className}`} aria-label="RealSync Dynamics & AI — Startseite">
      RealSync Dynamics <span className="rs-wordmark__ai">&amp; AI</span>
    </Link>
  );
}
