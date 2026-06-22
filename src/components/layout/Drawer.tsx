import React, { useState, useEffect, useCallback } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: 'left' | 'right';
  width?: 'sm' | 'md' | 'lg';
  closeButton?: boolean;
  onEscape?: boolean;
}

const widthClasses = {
  sm: 'w-64',
  md: 'w-96',
  lg: 'w-[500px]',
};

export const Drawer = React.forwardRef<HTMLDivElement, DrawerProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      side = 'left',
      width = 'md',
      closeButton = true,
      onEscape = true,
    },
    ref
  ) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
      if (isOpen) {
        setShouldRender(true);
        requestAnimationFrame(() => setIsAnimating(true));
        document.body.style.overflow = 'hidden';
      } else {
        setIsAnimating(false);
        const timer = setTimeout(() => setShouldRender(false), 300);
        return () => {
          clearTimeout(timer);
          document.body.style.overflow = 'unset';
        };
      }
    }, [isOpen]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (e.key === 'Escape' && onEscape) {
          onClose();
        }
      },
      [onClose, onEscape]
    );

    useEffect(() => {
      if (isOpen) {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
      }
    }, [isOpen, handleKeyDown]);

    if (!shouldRender) return null;

    const sideClass = side === 'left' ? '-translate-x-full' : 'translate-x-full';
    const positionClass = side === 'left' ? 'left-0' : 'right-0';

    return (
      <div className={`fixed inset-0 z-modal ${isAnimating ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            isAnimating ? 'opacity-100' : 'opacity-0'
          } cursor-pointer`}
          onClick={onClose}
        />

        {/* Drawer Panel */}
        <div
          ref={ref}
          className={`absolute top-0 ${positionClass} h-full ${widthClasses[width]} bg-obsidian border border-titanium/20 shadow-2xl transition-transform duration-300 flex flex-col ${
            isAnimating ? 'translate-x-0' : sideClass
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          {(title || closeButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-titanium/10">
              {title && (
                <h2 className="text-2xl font-display font-semibold text-titanium">
                  {title}
                </h2>
              )}
              {closeButton && (
                <button
                  onClick={onClose}
                  className="ml-auto text-titanium/60 hover:text-titanium transition-colors focus:outline-none focus:ring-2 focus:ring-security-blue rounded p-1"
                  aria-label="Close drawer"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        </div>
      </div>
    );
  }
);

Drawer.displayName = 'Drawer';
