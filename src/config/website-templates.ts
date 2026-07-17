/**
 * Website Template Definitions
 * Single Source of Truth for AI Website Operations Layer
 *
 * Each template includes:
 * - Default layout structure
 * - Color scheme & branding
 * - Section templates (Hero, Services, About, etc)
 * - SEO baseline
 * - Compliance templates (Impressum, Datenschutz)
 */

export interface WebsiteTemplate {
  id: string;
  name: string;
  industry: string;
  description: string;
  thumbnail?: string;

  // Default color scheme
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };

  // Default typography
  typography: {
    headingFont: string;
    bodyFont: string;
    headingSize: string;
    bodySize: string;
  };

  // Sections included by default
  sections: string[]; // ['hero', 'services', 'about', 'gallery', 'testimonials', 'contact', 'faq']

  // Default content structure
  defaultContent: {
    hero?: {
      heading: string;
      subheading: string;
      ctaText: string;
    };
    services?: Array<{
      name: string;
      description: string;
      icon: string;
    }>;
    about?: {
      heading: string;
      description: string;
    };
  };

  // Compliance settings
  compliance: {
    requiresSpecialLicense?: boolean;
    dataHandlingRules: string[];
    recommendedPrivacyNotices: string[];
  };

  // SEO baseline
  seo: {
    metaDescriptionTemplate: string;
    keywordsTemplate: string[];
    ogImageInstructions: string;
  };
}

export const WEBSITE_TEMPLATES: Record<string, WebsiteTemplate> = {
  'tattoo-studio': {
    id: 'tattoo-studio',
    name: 'Tattoo Studio',
    industry: 'tattoo-studio',
    description: 'Professional tattoo studio website with gallery, artist profiles, and booking system',

    colors: {
      primary: '#1a1a1a', // Deep black
      secondary: '#ff6b35', // Warm orange
      accent: '#004e89', // Deep blue
      background: '#f5f5f5',
      text: '#333333',
    },

    typography: {
      headingFont: 'Inter, sans-serif',
      bodyFont: 'Inter, sans-serif',
      headingSize: '2.5rem',
      bodySize: '1rem',
    },

    sections: ['hero', 'gallery', 'services', 'artists', 'testimonials', 'contact', 'faq'],

    defaultContent: {
      hero: {
        heading: 'Professionelle Tätowierungen',
        subheading: 'Künstlerische Designs von erfahrenen Profis',
        ctaText: 'Termin buchen',
      },
      services: [
        {
          name: 'Custom Designs',
          description: 'Individuelle Designs nach Ihren Wünschen',
          icon: 'pencil',
        },
        {
          name: 'Cover-ups',
          description: 'Professionelle Überdeckung älterer Tätowierungen',
          icon: 'refresh',
        },
        {
          name: 'Healing & Aftercare',
          description: 'Professionelle Nachsorge und Beratung',
          icon: 'heart',
        },
      ],
    },

    compliance: {
      requiresSpecialLicense: false,
      dataHandlingRules: ['Age verification requirement', 'Consent documentation'],
      recommendedPrivacyNotices: [
        'Photos of customers may be used for portfolio (with consent)',
        'Aftercare instructions will be sent via email',
      ],
    },

    seo: {
      metaDescriptionTemplate: 'Professionelle Tätowierungen in [Stadt]. Custom Designs, erfahrene Artists, hygienische Voraussetzungen.',
      keywordsTemplate: ['Tattoo', '[Stadt]', 'Custom Tattoo', 'Professionelle Tätowierer'],
      ogImageInstructions: 'Showcase best portfolio piece or studio environment',
    },
  },

  'handwerker': {
    id: 'handwerker',
    name: 'Handwerksbetrieb',
    industry: 'handwerker',
    description: 'Multi-service handcraft business (plumbing, electrical, carpentry)',

    colors: {
      primary: '#2c3e50', // Professional dark blue-grey
      secondary: '#e74c3c', // Professional red
      accent: '#27ae60', // Professional green
      background: '#ecf0f1',
      text: '#34495e',
    },

    typography: {
      headingFont: 'Roboto, sans-serif',
      bodyFont: 'Roboto, sans-serif',
      headingSize: '2rem',
      bodySize: '0.95rem',
    },

    sections: ['hero', 'services', 'about', 'projects', 'testimonials', 'team', 'contact'],

    defaultContent: {
      hero: {
        heading: 'Handwerk mit Qualität und Zuverlässigkeit',
        subheading: 'Ihr Partner für professionelle Handwerksleistungen',
        ctaText: 'Kostenlos beraten lassen',
      },
      services: [
        { name: 'Reparaturen', description: 'Schnelle Lösungen für alltägliche Probleme', icon: 'wrench' },
        { name: 'Wartung', description: 'Regelmäßige Wartung zur Prävention', icon: 'tools' },
        { name: 'Neuinstallationen', description: 'Professionelle Installation neuer Systeme', icon: 'zap' },
      ],
    },

    compliance: {
      requiresSpecialLicense: true,
      dataHandlingRules: [
        'Craft business license disclosure',
        'Insurance coverage information',
        'Customer data protection for invoicing',
      ],
      recommendedPrivacyNotices: [
        'Before/after project photos (with customer consent)',
        'Customer testimonials may be published',
      ],
    },

    seo: {
      metaDescriptionTemplate: '[Handwerk-Typ] in [Stadt]. Zuverlässig, professionell, schnell. [Betriebsname].',
      keywordsTemplate: ['Handwerker', '[Stadt]', '[Handwerk-Typ]', 'Reparatur'],
      ogImageInstructions: 'Show completed project or team with equipment',
    },
  },

  'dienstleister': {
    id: 'dienstleister',
    name: 'Dienstleister',
    industry: 'dienstleister',
    description: 'Generic service provider (cleaning, coaching, consulting)',

    colors: {
      primary: '#0f766e', // Petrol (RealSync brand)
      secondary: '#f5f5f5',
      accent: '#0052ff', // Security blue
      background: '#ffffff',
      text: '#1f2937',
    },

    typography: {
      headingFont: 'Poppins, sans-serif',
      bodyFont: 'Inter, sans-serif',
      headingSize: '2.25rem',
      bodySize: '1rem',
    },

    sections: ['hero', 'services', 'about', 'process', 'testimonials', 'pricing', 'contact'],

    defaultContent: {
      hero: {
        heading: 'Professionelle Dienstleistungen',
        subheading: 'Für Ihre Ziele und Erfolg',
        ctaText: 'Kontakt aufnehmen',
      },
      services: [
        { name: 'Service A', description: 'Beschreibung des Services', icon: 'star' },
        { name: 'Service B', description: 'Beschreibung des Services', icon: 'target' },
        { name: 'Service C', description: 'Beschreibung des Services', icon: 'check' },
      ],
    },

    compliance: {
      requiresSpecialLicense: false,
      dataHandlingRules: ['Customer contact data protection', 'Booking system privacy'],
      recommendedPrivacyNotices: [
        'How customer data is used for service delivery',
        'Newsletter opt-in (if applicable)',
      ],
    },

    seo: {
      metaDescriptionTemplate: '[Service] in [Stadt]. Professionell, zuverlässig, persönlich.',
      keywordsTemplate: ['[Service]', '[Stadt]', 'Dienstleister', 'Beratung'],
      ogImageInstructions: 'Show professional service in action or team portrait',
    },
  },

  'einzelunternehmer': {
    id: 'einzelunternehmer',
    name: 'Einzelunternehmer',
    industry: 'einzelunternehmer',
    description: 'Freelancer or solo entrepreneur (coach, designer, writer, consultant)',

    colors: {
      primary: '#1e293b', // Slate dark
      secondary: '#64748b', // Slate medium
      accent: '#0f766e', // Petrol
      background: '#f8fafc',
      text: '#0f172a',
    },

    typography: {
      headingFont: 'Playfair Display, serif',
      bodyFont: 'Inter, sans-serif',
      headingSize: '2.75rem',
      bodySize: '1rem',
    },

    sections: ['hero', 'about', 'services', 'portfolio', 'testimonials', 'contact'],

    defaultContent: {
      hero: {
        heading: 'Ihr persönlicher Partner',
        subheading: 'Für Ihre persönliche und berufliche Entwicklung',
        ctaText: 'Jetzt anfangen',
      },
      about: {
        heading: 'Über mich',
        description: 'Persönliche Story und Expertise...',
      },
    },

    compliance: {
      requiresSpecialLicense: false,
      dataHandlingRules: ['Solo business registration disclosure', 'Tax ID transparency'],
      recommendedPrivacyNotices: [
        'How customer data is processed',
        'Testimonial consent',
      ],
    },

    seo: {
      metaDescriptionTemplate: '[Service] von [Name]. Persönlich, professionell, erfahren.',
      keywordsTemplate: ['[Service]', '[Name]', 'Freelancer', '[Spezialisierung]'],
      ogImageInstructions: 'Professional portrait or service showcase',
    },
  },
};

/**
 * Get template by industry
 */
export function getTemplate(industry: string): WebsiteTemplate | undefined {
  return WEBSITE_TEMPLATES[industry];
}

/**
 * List all available industries
 */
export function listAvailableIndustries(): string[] {
  return Object.keys(WEBSITE_TEMPLATES).map((key) => ({
    id: key,
    name: WEBSITE_TEMPLATES[key].name,
  }));
}

/**
 * Default colors for fallback (if template not found)
 */
export const DEFAULT_COLORS = {
  primary: '#0f766e',
  secondary: '#f5f5f5',
  accent: '#0052ff',
  background: '#ffffff',
  text: '#1f2937',
};
