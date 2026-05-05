import React from 'react';

interface SovereignButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const SovereignButton = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '', 
  ...props 
}: SovereignButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center font-mono font-bold uppercase tracking-widest transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-[#0052FF] text-white hover:bg-[#0041CC] shadow-[4px_4px_0px_0px_#0A0A0B] active:translate-x-1 active:translate-y-1 active:shadow-none",
    secondary: "bg-[#E2E2E2] text-[#0A0A0B] hover:bg-obsidian-900 shadow-[4px_4px_0px_0px_#0A0A0B] active:translate-x-1 active:translate-y-1 active:shadow-none",
    outline: "bg-transparent border-2 border-[#E2E2E2] text-[#E2E2E2] hover:bg-[#E2E2E2] hover:text-[#0A0A0B] active:bg-obsidian-900 active:border-white",
    ghost: "bg-transparent text-[#E2E2E2] hover:bg-[#E2E2E2]/10",
  };

  const sizes = {
    sm: "px-4 py-2 text-[10px]",
    md: "px-6 py-3 text-xs",
    lg: "px-8 py-4 text-sm",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
