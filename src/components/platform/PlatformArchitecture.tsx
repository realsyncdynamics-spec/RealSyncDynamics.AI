import { Link } from 'react-router-dom';
import {
  PLATFORM_BASIS_TITLE,
  PLATFORM_CONTROLS,
  PLATFORM_ENTRY,
  PLATFORM_MODULES,
  PLATFORM_STACK,
  PLATFORM_TITLE,
  badgeLabel,
  moduleBadge,
  type PlatformModule,
} from './platformArchitecture';
import './platform-architecture.css';

function Mark({ moduleId }: { moduleId: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (moduleId) {
    case 'governance-os':
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6l-7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'agent-studio':
      return (
        <svg {...common}>
          <path d="M4 8h10a4 4 0 0 1 0 8H8" />
          <path d="M8 12h8" />
          <circle cx="18" cy="7" r="2" />
        </svg>
      );
    case 'creative-studio':
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="m8 15 2.5-3 2 2 2-2.5L17 15" />
          <circle cx="9" cy="9" r="1" />
        </svg>
      );
    case 'builder':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="16" height="7" rx="1.5" />
        </svg>
      );
    case 'operations':
      return (
        <svg {...common}>
          <rect x="6" y="8" width="12" height="9" rx="2" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          <path d="M12 12v2" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 16V8M10 16V5M16 16v-4M20 16V7" />
        </svg>
      );
  }
}

function ModuleCard({ module }: { module: PlatformModule }) {
  const badge = moduleBadge(module);
  return (
    <Link className="platform-arch__card" to={module.href} data-module={module.id}>
      <span className="platform-arch__card-top">
        <span className="platform-arch__icon">
          <Mark moduleId={module.id} />
        </span>
        <span className="platform-arch__badge" data-kind={badge}>
          <span className="platform-arch__dot" aria-hidden="true" />
          {badgeLabel(badge)}
        </span>
      </span>
      <span className="platform-arch__card-title">{module.title}</span>
      <span className="platform-arch__card-summary">{module.summary}</span>
    </Link>
  );
}

/** Skizze als Light-Experience: Einstieg, sechs Module, gemeinsame Basis. */
export function PlatformArchitecture() {
  return (
    <div className="platform-arch" data-theme="light-cream" data-testid="platform-architecture">
      <div className="platform-arch__inner">
        <p className="platform-arch__kicker">Eine gemeinsame Plattform</p>
        <article className="platform-arch__entry">
          <img src="/brand/logo-square-400.svg" alt="" width={34} height={34} />
          <div>
            <h2 className="platform-arch__title">{PLATFORM_TITLE}</h2>
            <p className="platform-arch__entry-line">
              {PLATFORM_ENTRY.map((item, index) => (
                <span key={item.href}>
                  {index > 0 ? <span aria-hidden="true"> · </span> : null}
                  <Link to={item.href}>{item.label}</Link>
                </span>
              ))}
            </p>
          </div>
        </article>
        <p className="platform-arch__bridge" aria-hidden="true">
          ↓ Eine gemeinsame Plattform ↓
        </p>
        <ul className="platform-arch__grid">
          {PLATFORM_MODULES.map((module) => (
            <li key={module.id}>
              <ModuleCard module={module} />
            </li>
          ))}
        </ul>
        <p className="platform-arch__bridge" aria-hidden="true">
          ↓
        </p>
        <article className="platform-arch__basis">
          <h2 className="platform-arch__title">{PLATFORM_BASIS_TITLE}</h2>
          <p>{PLATFORM_STACK.join(' · ')}</p>
          <p>{PLATFORM_CONTROLS.join(' · ')}</p>
        </article>
      </div>
    </div>
  );
}
