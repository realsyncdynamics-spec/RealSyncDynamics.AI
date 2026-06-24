import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import de from './translations/de.json';
import en from './translations/en.json';

export type Language = 'de' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replace?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = { de, en };

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'de';
    const stored = localStorage.getItem('realsync-language');
    if (stored === 'de' || stored === 'en') return stored;
    // Browser-Sprache fallback
    const browserLang = navigator.language.substring(0, 2);
    return browserLang === 'de' ? 'de' : 'en';
  });

  const t = (key: string, replace?: Record<string, string>): string => {
    let value = translations[language][key];
    if (!value) {
      value = translations.en[key] || key;
    }
    if (replace) {
      Object.entries(replace).forEach(([placeholder, replacement]) => {
        value = value.replace(`{${placeholder}}`, replacement);
      });
    }
    return value;
  };

  const setLanguageSafe = (lang: Language) => {
    setLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('realsync-language', lang);
    }
  };

  const contextValue = useMemo(() => ({
    language,
    setLanguage: setLanguageSafe,
    t
  }), [language]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export default LanguageProvider;
