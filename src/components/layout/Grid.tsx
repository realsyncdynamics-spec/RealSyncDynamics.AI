import React from 'react';

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  children: React.ReactNode;
}

const gapClasses = {
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
  '2xl': 'gap-12',
};

const getGridColumnsClass = (columns: number | undefined): string => {
  if (!columns) return 'grid-cols-1';
  return `grid-cols-${columns}`;
};

export const Grid = React.forwardRef<HTMLDivElement, GridProps>(
  (
    {
      columns = 1,
      gap = 'md',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    let columnsClass = '';

    if (typeof columns === 'number') {
      columnsClass = getGridColumnsClass(columns);
    } else {
      const { sm = 1, md = 2, lg = 3, xl = 4 } = columns;
      columnsClass = `grid-cols-${sm} md:grid-cols-${md} lg:grid-cols-${lg} xl:grid-cols-${xl}`;
    }

    return (
      <div
        ref={ref}
        className={`grid ${columnsClass} ${gapClasses[gap]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';
