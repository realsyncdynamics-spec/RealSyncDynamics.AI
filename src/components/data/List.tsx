import React from 'react';

interface ListItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export const ListItem = React.forwardRef<HTMLLIElement, ListItemProps>(
  (
    { icon, title, description, action, children, className = '', ...props },
    ref
  ) => (
    <li
      ref={ref}
      className={`flex items-start gap-3 px-4 py-3 border-b border-titanium/10 hover:bg-titanium/5 transition-colors last:border-b-0 ${className}`}
      {...props}
    >
      {icon && (
        <div className="flex-shrink-0 flex items-center justify-center text-titanium/60 mt-1">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {children ? (
          children
        ) : (
          <>
            {title && (
              <p className="font-mono font-semibold text-titanium">{title}</p>
            )}
            {description && (
              <p className="font-mono text-sm text-titanium/60">{description}</p>
            )}
          </>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </li>
  )
);

ListItem.displayName = 'ListItem';

interface ListProps extends React.UlHTMLAttributes<HTMLUListElement> {
  variant?: 'default' | 'compact';
  children: React.ReactNode;
}

export const List = React.forwardRef<HTMLUListElement, ListProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => (
    <ul
      ref={ref}
      className={`border border-titanium/10 rounded-lg overflow-hidden bg-obsidian/30 ${className}`}
      {...props}
    >
      {children}
    </ul>
  )
);

List.displayName = 'List';
