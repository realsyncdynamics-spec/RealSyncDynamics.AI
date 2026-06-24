import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';

export type Language = 'de' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, replace?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translations defined inline (TypeScript, not JSON import)
const translations: Record<Language, Record<string, string>> = {
  de: {
    'common.language': 'Sprache',
    'common.deutsch': 'Deutsch',
    'common.english': 'English',
    'common.loading': 'Wird geladen…',
    'common.error': 'Fehler',
    'common.success': 'Erfolg',
    'common.confirm': 'Bestätigen',
    'common.cancel': 'Abbrechen',
    'common.save': 'Speichern',
    'common.delete': 'Löschen',
    'common.edit': 'Bearbeiten',
    'common.back': 'Zurück',
    'common.next': 'Weiter',
    'common.logout': 'Abmelden',
    'landing.hero.title': 'EU-souveräne Compliance-Infrastruktur',
    'landing.hero.subtitle': 'Automatisierte DSGVO- und EU-AI-Act-Audits für Unternehmen und Agenturen',
    'landing.hero.cta': 'Kostenlos starten',
    'pricing.title': 'Transparente Preise für Ihr Governance OS',
    'pricing.subtitle': 'Starten Sie kostenlos, wachsen Sie ohne Überraschungen. Alle Pläne beinhalten Hosting & Betrieb in der EU.',
    'checkout.title': 'Zahlungsabwicklung',
    'checkout.confirm_and_pay': 'Bestellung bestätigen und zahlen',
    'checkout.processing': 'Zahlung wird verarbeitet…',
    'checkout.success.title': 'Zahlung erfolgreich',
    'checkout.success.message': 'Vielen Dank! Ihre Zahlung wurde verarbeitet.',
    'dashboard.welcome': 'Willkommen, {name}',
    'auth.login': 'Einloggen',
    'auth.signup': 'Registrieren',
    'error.404': 'Seite nicht gefunden',
  },
  en: {
    'common.language': 'Language',
    'common.deutsch': 'Deutsch',
    'common.english': 'English',
    'common.loading': 'Loading…',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.logout': 'Log Out',
    'landing.hero.title': 'EU-sovereign Compliance Infrastructure',
    'landing.hero.subtitle': 'Automated GDPR and EU AI Act audits for enterprises and agencies',
    'landing.hero.cta': 'Get started free',
    'pricing.title': 'Transparent Pricing for Your Governance OS',
    'pricing.subtitle': 'Start free, grow without surprises. All plans include EU hosting & operations.',
    'checkout.title': 'Payment',
    'checkout.confirm_and_pay': 'Confirm and Pay',
    'checkout.processing': 'Processing payment…',
    'checkout.success.title': 'Payment Successful',
    'checkout.success.message': 'Thank you! Your payment has been processed.',
    'dashboard.welcome': 'Welcome, {name}',
    'auth.login': 'Log In',
    'auth.signup': 'Sign Up',
    'error.404': 'Page Not Found',
  },
};

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
