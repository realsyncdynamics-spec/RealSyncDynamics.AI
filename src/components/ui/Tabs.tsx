import React, { useState, useRef } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  defaultTabId?: string;
  onChange?: (tabId: string) => void;
  variant?: 'default' | 'contained';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      tabs,
      defaultTabId,
      onChange,
      variant = 'default',
      size = 'md',
      className = '',
    },
    ref
  ) => {
    const [activeTabId, setActiveTabId] = useState(
      defaultTabId || tabs[0]?.id || ''
    );
    const tabButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

    const handleTabClick = (tabId: string) => {
      if (tabs.find(t => t.id === tabId)?.disabled) return;
      setActiveTabId(tabId);
      onChange?.(tabId);
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
      let newIndex = index;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          newIndex = index > 0 ? index - 1 : tabs.length - 1;
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          newIndex = index < tabs.length - 1 ? index + 1 : 0;
          break;
        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      const newTab = tabs[newIndex];
      if (newTab && !newTab.disabled) {
        handleTabClick(newTab.id);
        tabButtonsRef.current[newIndex]?.focus();
      }
    };

    const tabSizeStyles = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2.5 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    const activeTab = tabs.find(t => t.id === activeTabId);

    return (
      <div ref={ref} className={`flex flex-col gap-4 ${className}`}>
        <div
          className={`flex gap-0 border-b border-titanium/20 ${
            variant === 'contained' ? 'bg-obsidian/50 p-1 rounded-lg border-0' : ''
          }`}
          role="tablist"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={el => {
                tabButtonsRef.current[index] = el;
              }}
              role="tab"
              aria-selected={activeTabId === tab.id}
              aria-controls={`panel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={e => handleKeyDown(e, index)}
              className={`flex items-center gap-2 font-mono font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-obsidian focus:ring-security-blue ${tabSizeStyles[size]} ${
                activeTabId === tab.id
                  ? variant === 'contained'
                    ? 'bg-security-blue text-obsidian rounded-md'
                    : 'text-titanium border-b-2 border-security-blue -mb-[2px]'
                  : 'text-titanium/60 hover:text-titanium'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tab.icon && <span className="flex items-center justify-center">{tab.icon}</span>}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab && (
          <div
            id={`panel-${activeTabId}`}
            role="tabpanel"
            aria-labelledby={activeTabId}
            className="animate-in fade-in-50 duration-200"
          >
            {activeTab.content}
          </div>
        )}
      </div>
    );
  }
);

Tabs.displayName = 'Tabs';
