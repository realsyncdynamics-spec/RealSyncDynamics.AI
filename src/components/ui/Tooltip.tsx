import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  (
    {
      content,
      children,
      position = 'top',
      delay = 200,
      className = '',
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = useState(false);
    const [computedPosition, setComputedPosition] = useState(position);
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const showTooltip = () => {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    };

    const hideTooltip = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setIsVisible(false);
    };

    useEffect(() => {
      if (!isVisible || !triggerRef.current || !tooltipRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewport = {
        top: 0,
        left: 0,
        right: window.innerWidth,
        bottom: window.innerHeight,
      };

      let finalPosition = position;

      // Check if tooltip goes outside viewport and adjust
      if (position === 'top' && triggerRect.top - tooltipRect.height < viewport.top + 5) {
        finalPosition = 'bottom';
      } else if (
        position === 'bottom' &&
        triggerRect.bottom + tooltipRect.height > viewport.bottom - 5
      ) {
        finalPosition = 'top';
      } else if (position === 'left' && triggerRect.left - tooltipRect.width < viewport.left + 5) {
        finalPosition = 'right';
      } else if (
        position === 'right' &&
        triggerRect.right + tooltipRect.width > viewport.right - 5
      ) {
        finalPosition = 'left';
      }

      setComputedPosition(finalPosition);
    }, [isVisible, position]);

    const positionClasses = {
      top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
      bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
      left: 'right-full mr-2 top-1/2 -translate-y-1/2',
      right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    };

    const arrowClasses = {
      top: 'bottom-[-4px] left-1/2 -translate-x-1/2 border-8 border-obsidian/90 border-t-obsidian/90 border-r-transparent border-b-transparent border-l-transparent',
      bottom: 'top-[-4px] left-1/2 -translate-x-1/2 border-8 border-obsidian/90 border-b-obsidian/90 border-r-transparent border-t-transparent border-l-transparent',
      left: 'right-[-4px] top-1/2 -translate-y-1/2 border-8 border-obsidian/90 border-l-obsidian/90 border-r-transparent border-b-transparent border-t-transparent',
      right: 'left-[-4px] top-1/2 -translate-y-1/2 border-8 border-obsidian/90 border-r-obsidian/90 border-l-transparent border-b-transparent border-t-transparent',
    };

    return (
      <div
        ref={ref}
        className="relative inline-flex"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        <div ref={triggerRef}>{children}</div>

        {isVisible && (
          <div
            ref={tooltipRef}
            className={`absolute z-tooltip pointer-events-none ${positionClasses[computedPosition]} ${className}`}
          >
            <div className="relative bg-obsidian/90 text-titanium text-sm px-3 py-2 rounded-md whitespace-nowrap font-mono shadow-lg backdrop-blur-sm border border-titanium/20">
              {content}
              <div className={`absolute ${arrowClasses[computedPosition]}`} />
            </div>
          </div>
        )}
      </div>
    );
  }
);

Tooltip.displayName = 'Tooltip';
