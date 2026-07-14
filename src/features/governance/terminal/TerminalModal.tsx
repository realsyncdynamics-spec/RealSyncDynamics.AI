import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { TerminalInterface } from './TerminalInterface';

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCommand?: string;
}

export function TerminalModal({ isOpen, onClose, initialCommand }: TerminalModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full h-full md:w-[90vw] md:h-[90vh] md:max-w-6xl md:max-h-3xl md:rounded-lg flex flex-col bg-obsidian-900 border border-titanium-700 md:border-2">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-titanium-700 bg-obsidian-800 flex-shrink-0">
          <span className="font-mono text-sm text-titanium-400">
            RealSync Governance Runtime Terminal
          </span>
          <button
            onClick={onClose}
            className="p-2 hover:bg-obsidian-700 rounded transition-colors"
            aria-label="Close terminal"
          >
            <X size={18} className="text-titanium-400 hover:text-titanium-300" />
          </button>
        </div>

        {/* Terminal */}
        <div className="flex-1 overflow-hidden">
          <TerminalInterface />
        </div>
      </div>
    </div>
  );
}

export function useTerminalModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialCommand, setInitialCommand] = useState<string | undefined>();

  const open = useCallback((cmd?: string) => {
    setInitialCommand(cmd);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setInitialCommand(undefined);
  }, []);

  return {
    isOpen,
    open,
    close,
    initialCommand,
  };
}
