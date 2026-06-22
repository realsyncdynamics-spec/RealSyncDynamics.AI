import React from 'react';

interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  children: React.ReactNode;
  required?: boolean;
}

export const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ children, required = false, className = '', ...props }, ref) => (
    <label
      ref={ref}
      className={`block text-sm font-semibold text-titanium ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
);

FormLabel.displayName = 'FormLabel';

interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const FormError = React.forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ children, className = '', ...props }, ref) => (
    <p ref={ref} className={`text-xs text-red-400 font-mono ${className}`} {...props}>
      {children}
    </p>
  )
);

FormError.displayName = 'FormError';

interface FormHelperProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
}

export const FormHelper = React.forwardRef<HTMLParagraphElement, FormHelperProps>(
  ({ children, className = '', ...props }, ref) => (
    <p ref={ref} className={`text-xs text-titanium/60 font-mono ${className}`} {...props}>
      {children}
    </p>
  )
);

FormHelper.displayName = 'FormHelper';

interface FieldsetProps extends React.FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend?: string;
  children: React.ReactNode;
}

export const Fieldset = React.forwardRef<HTMLFieldSetElement, FieldsetProps>(
  ({ legend, children, className = '', ...props }, ref) => (
    <fieldset
      ref={ref}
      className={`border border-titanium/20 rounded-lg p-4 space-y-4 ${className}`}
      {...props}
    >
      {legend && (
        <legend className="text-sm font-semibold text-titanium px-2">
          {legend}
        </legend>
      )}
      {children}
    </fieldset>
  )
);

Fieldset.displayName = 'Fieldset';
