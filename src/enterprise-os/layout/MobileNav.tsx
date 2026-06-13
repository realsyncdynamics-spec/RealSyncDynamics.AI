import React from 'react';
import { X } from 'lucide-react';
import { Logo } from '../../components/Logo';
import { NavList } from './NavList';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNav({ open, onClose }: MobileNavProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex lg:hidden">
      <div className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-titanium-800 bg-obsidian-900">
        <div className="flex h-14 items-center justify-between border-b border-titanium-800 px-4">
          <Logo size={26} />
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-titanium-400 hover:text-titanium-100"
            aria-label="Navigation schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <NavList onNavigate={onClose} />
        </nav>
      </div>
    </div>
  );
}
