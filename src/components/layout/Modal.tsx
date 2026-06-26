import React, { useState, useEffect, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'glass';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeButton?: boolean;
  onEscape?: boolean;
  nested?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const variantClasses = {
  default: 'bg-obsidian border border-titanium/20',
  glass: 'glass',
};

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen,
      onClose,
      title,
      children,
      variant = 'default',
      size = 'md',
      closeButton = true,
      onEscape = true,
      nested = false,
    },
    ref
  ) => {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
      if (isOpen) {
        setShouldRender(true);
        requestAnimationFrame(() => setIsAnimating(true));
        if (!nested) {
          document.body.style.overflow = 'hidden';
        }
      } else {
        setIsAnimating(false);
        const timer = setTimeout(() => setShouldRender(false), 300);
        return () => {
          clearTimeout(timer);
          if (!nested) {
            document.body.style.overflow = 'unset';
          }
        };
      }
    }, [isOpen, nested]);

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

    return (
      <div
        className={`fixed inset-0 z-modal flex items-center justify-center transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        } ${nested ? 'pointer-events-none' : ''}`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            isAnimating ? 'opacity-100' : 'opacity-0'
          } ${nested ? 'pointer-events-none' : 'cursor-pointer'}`}
          onClick={!nested ? onClose : undefined}
        />

        {/* Modal Content */}
        <div
          ref={ref}
          className={`relative ${sizeClasses[size]} w-full mx-4 rounded-lg shadow-2xl transition-all duration-300 ${
            variantClasses[variant]
          } ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'} pointer-events-auto`}
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
                  aria-label="Close modal"
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
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';
