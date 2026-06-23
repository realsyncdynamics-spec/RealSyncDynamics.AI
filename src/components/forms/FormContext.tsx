import React, { createContext, useContext, useState, useCallback } from 'react';

export interface FormError {
  [field: string]: string;
}

interface FormContextType {
  values: Record<string, any>;
  errors: FormError;
  touched: Set<string>;
  setFieldValue: (field: string, value: any) => void;
  setFieldError: (field: string, error: string) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  reset: () => void;
  isValid: boolean;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export const useForm = () => {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useForm must be used within FormProvider');
  }
  return context;
};

interface FormProviderProps {
  initialValues: Record<string, any>;
  children: React.ReactNode;
}

export const FormProvider = ({ initialValues, children }: FormProviderProps) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FormError>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const setFieldValue = useCallback((field: string, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const setFieldTouched = useCallback((field: string, isTouched: boolean) => {
    setTouched(prev => {
      const newTouched = new Set(prev);
      if (isTouched) {
        newTouched.add(field);
      } else {
        newTouched.delete(field);
      }
      return newTouched;
    });
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched(new Set());
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return (
    <FormContext.Provider
      value={{
        values,
        errors,
        touched,
        setFieldValue,
        setFieldError,
        setFieldTouched,
        reset,
        isValid,
      }}
    >
      {children}
    </FormContext.Provider>
  );
};
