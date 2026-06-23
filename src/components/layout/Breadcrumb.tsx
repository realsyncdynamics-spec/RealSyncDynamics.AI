import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrentPage?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export const Breadcrumb = React.forwardRef<HTMLElement, BreadcrumbProps>(
  ({ items, separator = '/', className = '' }, ref) => (
    <nav
      ref={ref}
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 ${className}`}
    >
      <ol className="flex items-center gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            {item.href && !item.isCurrentPage ? (
              <a
                href={item.href}
                className="text-titanium hover:text-security-blue transition-colors focus:outline-none focus:ring-2 focus:ring-security-blue rounded px-1"
              >
                {item.label}
              </a>
            ) : (
              <span
                className={
                  item.isCurrentPage
                    ? 'text-security-blue font-semibold'
                    : 'text-titanium/60'
                }
              >
                {item.label}
              </span>
            )}

            {index < items.length - 1 && (
              <span className="text-titanium/40 mx-1">{separator}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
);

Breadcrumb.displayName = 'Breadcrumb';
