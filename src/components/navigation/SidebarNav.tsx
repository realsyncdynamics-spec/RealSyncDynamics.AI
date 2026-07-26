import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export interface SidebarNavGroup {
  label: string;
  items: {
    label: string;
    href: string;
    icon?: React.ReactNode;
  }[];
}

interface SidebarNavProps {
  groups: SidebarNavGroup[];
  collapsible?: boolean;
  className?: string;
}

export const SidebarNav = React.forwardRef<HTMLDivElement, SidebarNavProps>(
  ({ groups, collapsible = true, className = '' }, ref) => {
    const location = useLocation();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
      groups.reduce((acc, group) => ({ ...acc, [group.label]: true }), {})
    );

    const isActive = (href: string) => location.pathname === href;

    const toggleGroup = (groupLabel: string) => {
      if (collapsible) {
        setExpandedGroups((prev) => ({
          ...prev,
          [groupLabel]: !prev[groupLabel],
        }));
      }
    };

    return (
      <div ref={ref} className={`flex flex-col gap-1 ${className}`}>
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider text-titanium/50 transition-colors hover:text-titanium/70"
            >
              <span>{group.label}</span>
              {collapsible && (
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    expandedGroups[group.label] ? '' : '-rotate-90'
                  }`}
                />
              )}
            </button>

            {/* Group Items */}
            {expandedGroups[group.label] && (
              <div className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
                      isActive(item.href)
                        ? 'bg-security-blue/15 text-security-blue border-l-2 border-security-blue'
                        : 'text-titanium/70 hover:text-titanium hover:bg-titanium/5'
                    }`}
                  >
                    {item.icon && <span className="flex items-center justify-center">{item.icon}</span>}
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
);

SidebarNav.displayName = 'SidebarNav';
