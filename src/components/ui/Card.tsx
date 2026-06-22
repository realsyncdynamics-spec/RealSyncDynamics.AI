import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass' | 'gradient';
  children: React.ReactNode;
}

const cardVariants = {
  default: 'bg-obsidian border border-titanium/20 rounded-card',
  elevated: 'bg-obsidian/80 border border-titanium/30 rounded-card shadow-lg',
  glass: 'glass',
  gradient: 'bg-gradient-to-br from-petrol/10 to-security-blue/5 border border-petrol/30 rounded-card backdrop-blur-md',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`${cardVariants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`px-6 py-4 border-b border-titanium/10 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = '', ...props }, ref) => (
    <h3
      ref={ref}
      className={`text-2xl font-display font-semibold text-titanium ${className}`}
      {...props}
    >
      {children}
    </h3>
  )
);

CardTitle.displayName = 'CardTitle';

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className = '', ...props }, ref) => (
    <p
      ref={ref}
      className={`text-sm text-titanium/60 mt-1 ${className}`}
      {...props}
    >
      {children}
    </p>
  )
);

CardDescription.displayName = 'CardDescription';

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`px-6 py-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`px-6 py-4 border-t border-titanium/10 flex gap-2 justify-end ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';
