/**
 * Cloudflare Configuration
 * Single Source of Truth for Cloudflare integration
 *
 * Used by:
 * - website-operations-agent (deployment orchestration)
 * - cloudflare-deployer (Pages/Workers/R2 setup)
 * - website-domain-manager (DNS/SSL automation)
 */

export interface CloudflareConfig {
  enabled: boolean;
  apiToken: string;
  accountId: string;
  pagesProjectName: string;
  r2BucketName: string;
  workerName: string;
  supportedTlds: string[];
  defaultSubdomainSuffix: string;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

/**
 * Load Cloudflare configuration from environment
 */
export function getCloudflareConfig(): CloudflareConfig {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    console.warn('Cloudflare API token or account ID not configured');
  }

  return {
    enabled: !!apiToken && !!accountId,
    apiToken: apiToken || '',
    accountId: accountId || '',

    // Project naming convention
    pagesProjectName: 'realsyncdynamics-customer-sites',
    r2BucketName: 'realsyncdynamics-websites',
    workerName: 'realsyncdynamics-website-router',

    // Domain configuration
    supportedTlds: [
      'realsyncdynamics.ai', // Primary managed domain
      'de', 'com', 'eu', 'info', 'net', 'org', // Popular TLDs
    ],
    defaultSubdomainSuffix: 'realsyncdynamics.ai',

    // Rate limiting (Cloudflare API limits)
    rateLimit: {
      requestsPerMinute: 1200, // Cloudflare standard
      burstLimit: 120, // Per-second burst
    },
  };
}

/**
 * Cloudflare Pages deployment configuration
 */
export const PAGES_CONFIG = {
  // Build settings
  buildCommand: 'npm run build',
  outputDir: 'dist',
  rootDir: '/',

  // Environment variables to pass to build
  buildEnvVars: {
    VITE_API_URL: 'https://realsyncdynamics.ai/api',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
  },

  // Compatibility flags
  compatibilityFlags: [
    'nodejs_compat', // Node.js compatibility for Deno workers
  ],

  // Deployment preview settings
  previewBranchIncludes: ['claude/*', 'preview/*', 'staging/*'],
  previewBranchExcludes: ['main', 'production'],

  // Custom domain configuration
  customDomainSettings: {
    minTtl: 300, // Minimum TTL in seconds
    maxTtl: 86400, // Maximum TTL
    defaultTtl: 3600, // Default TTL
  },
};

/**
 * Cloudflare R2 bucket configuration (for website assets)
 */
export const R2_CONFIG = {
  publicBucketName: 'realsyncdynamics-websites-public',
  privateBucketName: 'realsyncdynamics-websites-private',

  // Storage organization
  prefixes: {
    builds: 'builds/', // Versioned website builds
    assets: 'assets/', // Static assets (images, fonts)
    documents: 'documents/', // PDF exports, legal docs
    backups: 'backups/', // Website backups
  },

  // Retention policies
  retention: {
    builds: 30, // Keep 30 days of build history
    backups: 90, // Keep 90 days of backups
  },

  // Public access settings
  publicUrlTemplate: 'https://cdn.realsyncdynamics.ai/{key}',
  cacheControl: {
    html: 'public, max-age=300', // 5 minutes for HTML
    assets: 'public, max-age=31536000', // 1 year for versioned assets
  },
};

/**
 * Cloudflare Workers configuration (for API routing, etc)
 */
export const WORKERS_CONFIG = {
  routes: [
    {
      pattern: 'https://*/api/*',
      description: 'API requests to Supabase backend',
    },
    {
      pattern: 'https://*/admin/*',
      description: 'Admin panel authentication',
    },
  ],

  kv: {
    namespace: 'realsyncdynamics-websites',
    bindings: {
      WEBSITE_CONFIG: 'website-config-store',
      DEPLOYMENT_STATUS: 'deployment-status-cache',
      MAINTENANCE_LOG: 'maintenance-event-log',
    },
  },
};

/**
 * DNS configuration for custom domains
 */
export const DNS_CONFIG = {
  // CNAME target for subdomain delegation
  cnameTarget: 'realsyncdynamics.pages.dev',

  // Default DNS records to create
  defaultRecords: {
    'www': {
      type: 'CNAME',
      target: 'realsyncdynamics.pages.dev',
      ttl: 3600,
    },
    '@': {
      type: 'CNAME',
      target: 'realsyncdynamics.pages.dev',
      ttl: 3600,
    },
  },

  // Validation timeout (how long to wait for DNS propagation)
  validationTimeout: 300, // 5 minutes
  validationCheckInterval: 10, // Check every 10 seconds
  maxValidationAttempts: 30, // Max 30 attempts = 5 minutes total
};

/**
 * SSL/TLS configuration
 */
export const SSL_CONFIG = {
  minTlsVersion: '1.2',
  tlsMode: 'full', // Full SSL encryption to Supabase
  tlsClientAuth: false,

  // Certificate settings
  certificateType: 'universal', // Universal SSL certificate (free)
  autoRenew: true,

  // HSTS settings
  hstsEnabled: true,
  hstsMaxAge: 31536000, // 1 year
  hstsIncludeSubdomains: true,
  hstsPreload: true,
};

/**
 * Monitoring and analytics configuration
 */
export const MONITORING_CONFIG = {
  enableAnalytics: true,
  enableRealtime: true,

  // Metrics to track
  metrics: {
    pageViews: true,
    requests: true,
    cacheHitRate: true,
    responseTime: true,
    errors: true,
  },

  // Alerting thresholds
  alerts: {
    errorRate: 0.05, // Alert if > 5% errors
    responseTimeP95: 3000, // Alert if p95 > 3 seconds
    cacheHitRateLow: 0.3, // Alert if cache hit rate < 30%
  },
};

/**
 * Deployment stages and their Cloudflare settings
 */
export const DEPLOYMENT_STAGES = {
  preview: {
    pages_branch: 'preview',
    url_pattern: '{project}.preview.realsyncdynamics.pages.dev',
    ssl_mode: 'flexible',
    cache_level: 'bypass', // No caching for preview
  },
  staging: {
    pages_branch: 'staging',
    url_pattern: '{project}.staging.realsyncdynamics.pages.dev',
    ssl_mode: 'full',
    cache_level: 'cache_everything',
  },
  production: {
    pages_branch: 'main',
    url_pattern: '{project}.realsyncdynamics.pages.dev', // Or custom domain
    ssl_mode: 'full',
    cache_level: 'cache_everything',
  },
};

/**
 * Error handling and fallback configuration
 */
export const ERROR_CONFIG = {
  fallback404: '/404.html',
  fallback500: '/500.html',
  customErrorPages: {
    403: '/error/access-denied.html',
    404: '/error/not-found.html',
    500: '/error/server-error.html',
    503: '/error/maintenance.html',
  },
};

/**
 * Compatibility matrix for browser support
 */
export const BROWSER_SUPPORT = {
  minimal: {
    description: 'Modern browsers only (ES2020+)',
    es2020: true,
  },
  standard: {
    description: 'Extended browser support (ES2015)',
    es2015: true,
  },
};
