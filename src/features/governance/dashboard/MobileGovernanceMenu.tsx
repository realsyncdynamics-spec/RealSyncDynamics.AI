import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Menu } from 'lucide-react';
import { GovernanceDashboardTiles } from './GovernanceDashboardTiles';

interface MobileGovernanceMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileGovernanceMenu({ isOpen, onClose }: MobileGovernanceMenuProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-obsidian-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div className="absolute inset-x-0 top-0 bg-obsidian-950 border-b border-titanium-800">
        <div className="max-w-full px-4 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-titanium-50">
              Governance Module
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-obsidian-900 rounded-none transition-colors"
              aria-label="Menü schließen"
            >
              <X className="w-5 h-5 text-titanium-400" />
            </button>
          </div>

          {/* Tiles in Compact Layout */}
          <GovernanceDashboardTiles layout="compact" />
        </div>
      </div>
    </div>
  );
}

interface MobileGovernanceNavProps {
  onMenuOpen: () => void;
}

export function MobileGovernanceNav({ onMenuOpen }: MobileGovernanceNavProps) {
  return (
    <div className="flex lg:hidden items-center">
      <button
        onClick={onMenuOpen}
        className="p-2 hover:bg-obsidian-900 rounded-none transition-colors"
        aria-label="Module menü öffnen"
      >
        <Menu className="w-6 h-6 text-titanium-400" />
      </button>
    </div>
  );
}

export function useMobileGovernanceMenu() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
