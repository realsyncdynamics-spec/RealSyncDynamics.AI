import React, { useState } from 'react';
import { SovereignButton } from '../ui/SovereignButton';

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  active?: boolean;
}

interface NavbarProps {
  logo?: React.ReactNode;
  title?: string;
  items?: NavItem[];
  actions?: React.ReactNode;
  sticky?: boolean;
  mobileMenuButton?: boolean;
  onMobileMenuToggle?: (isOpen: boolean) => void;
  className?: string;
}

export const Navbar = React.forwardRef<HTMLNavElement, NavbarProps>(
  (
    {
      logo,
      title,
      items = [],
      actions,
      sticky = true,
      mobileMenuButton = true,
      onMobileMenuToggle,
      className = '',
    },
    ref
  ) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleMobileMenuToggle = () => {
      const newState = !isMobileMenuOpen;
      setIsMobileMenuOpen(newState);
      onMobileMenuToggle?.(newState);
    };

    return (
      <nav
        ref={ref}
        className={`bg-obsidian border-b border-titanium/10 ${
          sticky ? 'sticky top-0 z-sticky' : ''
        } ${className}`}
      >
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-8">
            {/* Logo & Title */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {logo && <div className="flex items-center justify-center">{logo}</div>}
              {title && (
                <h1 className="text-xl font-display font-semibold text-titanium hidden sm:block">
                  {title}
                </h1>
              )}
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {items.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-mono font-semibold transition-colors ${
                    item.active
                      ? 'text-security-blue bg-security-blue/10'
                      : 'text-titanium/70 hover:text-titanium hover:bg-titanium/5'
                  }`}
                >
                  {item.icon && <span className="flex items-center justify-center">{item.icon}</span>}
                  {item.label}
                </a>
              ))}
            </div>

            {/* Actions & Mobile Menu Button */}
            <div className="flex items-center gap-4 ml-auto">
              {actions && <div>{actions}</div>}

              {mobileMenuButton && (
                <button
                  onClick={handleMobileMenuToggle}
                  className="md:hidden p-2 text-titanium hover:bg-titanium/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-security-blue"
                  aria-label="Toggle menu"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    {isMobileMenuOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-titanium/10 flex flex-col gap-2 animate-in fade-in-50 duration-200">
              {items.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md font-mono font-semibold transition-colors ${
                    item.active
                      ? 'text-security-blue bg-security-blue/10'
                      : 'text-titanium/70 hover:text-titanium hover:bg-titanium/5'
                  }`}
                >
                  {item.icon && <span className="flex items-center justify-center">{item.icon}</span>}
                  {item.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>
    );
  }
);

Navbar.displayName = 'Navbar';
