import { Link } from 'react-router-dom';
import '../../styles/governance-os-handoff.css';

/** Wortmarke „RealSync Dynamics.AI" — Inter Tight 600 20px, „.AI" in Cyan (Handoff v2). */
export function BrandWordmark({ to = '/', className = '' }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`rs-wordmark ${className}`} aria-label="RealSync Dynamics.AI — Startseite">
      RealSync Dynamics<span className="rs-wordmark__ai">.AI</span>
    </Link>
  );
}
