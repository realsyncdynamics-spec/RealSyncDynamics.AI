import React from 'react';
import { useForm } from './FormContext';

interface FormFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string;
  children: (fieldProps: {
    value: unknown;
    onChange: (value: unknown) => void;
    onBlur: () => void;
    error?: string;
    touched: boolean;
  }) => React.ReactNode;
}

export const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ name, children, className = '', ...props }, ref) => {
    const { values, errors, touched, setFieldValue, setFieldTouched } = useForm();

    const handleChange = (value: unknown) => {
      setFieldValue(name, value);
    };

    const handleBlur = () => {
      setFieldTouched(name, true);
    };

    const error = errors[name];
    const isTouched = touched.has(name);

    return (
      <div ref={ref} className={`flex flex-col gap-1 ${className}`} {...props}>
        {children({
          value: values[name],
          onChange: handleChange,
          onBlur: handleBlur,
          error: isTouched ? error : undefined,
          touched: isTouched,
        })}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
