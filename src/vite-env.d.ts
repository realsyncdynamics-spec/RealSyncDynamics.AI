/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_ANON_JWT?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_AUTH_GOOGLE_ENABLED?: string;
  readonly VITE_AUTH_AZURE_ENABLED?: string;
  readonly VITE_AUTH_LINKEDIN_ENABLED?: string;
  readonly VITE_AUTH_GITHUB_ENABLED?: string;
  /** 'true' schaltet Governance AI (/app/assistant) ein. Standard: aus. */
  readonly VITE_GOVERNANCE_AI_ENABLED?: string;
  readonly VITE_META_PIXEL_ID?: string;
  readonly VITE_TIKTOK_PIXEL_ID?: string;
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
  readonly VITE_GOOGLE_ADS_LABEL_LEAD?: string;
  readonly VITE_GOOGLE_ADS_LABEL_TRIAL?: string;
  readonly VITE_GOOGLE_ADS_LABEL_PURCHASE?: string;
  readonly VITE_LINKEDIN_PARTNER_ID?: string;
  readonly VITE_LINKEDIN_CONVERSION_LEAD?: string;
  readonly VITE_LINKEDIN_CONVERSION_TRIAL?: string;
  readonly VITE_LINKEDIN_CONVERSION_PURCHASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
