import React from 'react';
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface GovernanceMobileMenuProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: 'Übersicht', href: '/app/dashboard' },
  { label: 'Workspace', href: '/app/overview' },
  { label: 'Websites', href: '/app/websites' },
  { label: 'Evidence Vault', href: '/app/evidence' },
  { label: 'Billing', href: '/app/billing' },
  { label: 'Agenten', href: '/app/agents' },
  { label: 'Automationen', href: '/app/automations' },
  { label: 'Dokumente', href: '/app/documents' },
  { label: 'Einstellungen', href: '/app/settings' },
];

export function GovernanceMobileMenu({ open, onClose }: GovernanceMobileMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex lg:hidden">
      <div
        className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex h-full w-64 max-w-[85vw] flex-col border-r border-titanium-800 bg-obsidian-900">
        <div className="flex h-14 items-center justify-between border-b border-titanium-800 px-4 shrink-0">
          <span className="font-display font-bold text-sm text-titanium-50">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-titanium-400 hover:text-titanium-100 transition-colors"
            aria-label="Menü schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className="block px-3 py-2.5 text-sm font-medium text-titanium-300 hover:text-titanium-50 hover:bg-obsidian-800 transition-colors rounded-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
