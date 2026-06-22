import React, { useState } from 'react';

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  active?: boolean;
  children?: SidebarItem[];
}

interface SidebarProps {
  items: SidebarItem[];
  collapsible?: boolean;
  className?: string;
  onItemClick?: (item: SidebarItem) => void;
}

export const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      items,
      collapsible = true,
      className = '',
      onItemClick,
    },
    ref
  ) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpanded = (itemId: string) => {
      const newExpanded = new Set(expandedItems);
      if (newExpanded.has(itemId)) {
        newExpanded.delete(itemId);
      } else {
        newExpanded.add(itemId);
      }
      setExpandedItems(newExpanded);
    };

    const handleItemClick = (item: SidebarItem) => {
      if (item.children && item.children.length > 0) {
        toggleExpanded(item.id);
      }
      onItemClick?.(item);
    };

    const renderItem = (item: SidebarItem, depth = 0) => {
      const isExpanded = expandedItems.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      return (
        <div key={item.id}>
          <button
            onClick={() => handleItemClick(item)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-mono text-sm font-semibold transition-colors ${
              item.active
                ? 'text-security-blue bg-security-blue/10'
                : 'text-titanium/70 hover:text-titanium hover:bg-titanium/5'
            } ${depth > 0 ? 'ml-4' : ''}`}
          >
            {item.icon && (
              <span className={`flex-shrink-0 flex items-center justify-center ${isCollapsed && depth === 0 ? 'w-6 h-6' : ''}`}>
                {item.icon}
              </span>
            )}
            {(!isCollapsed || depth > 0) && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && <span className="ml-auto">{item.badge}</span>}
                {hasChildren && (
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </>
            )}
          </button>

          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">
              {item.children!.map(child => renderItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <aside
        ref={ref}
        className={`bg-obsidian border-r border-titanium/10 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${className}`}
      >
        <div className="h-full flex flex-col p-4 gap-4">
          {/* Collapse Button */}
          {collapsible && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 text-titanium/60 hover:text-titanium hover:bg-titanium/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-security-blue"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* Navigation Items */}
          <nav className="flex-1 space-y-1 overflow-y-auto">
            {items.map(item => renderItem(item))}
          </nav>
        </div>
      </aside>
    );
  }
);

Sidebar.displayName = 'Sidebar';
