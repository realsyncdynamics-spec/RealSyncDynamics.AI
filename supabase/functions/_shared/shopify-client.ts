// Shopify GraphQL Admin API client. REST is legacy for new apps —
// only GraphQL here. API version pinned via env (SHOPIFY_API_VERSION),
// default '2026-01'.
//
// Read-only queries only. No mutations.

const DEFAULT_API_VERSION = '2026-01';

export interface ShopifyGraphQLResult<T = unknown> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  extensions?: { cost?: { requestedQueryCost: number; actualQueryCost: number; throttleStatus: { maximumAvailable: number; currentlyAvailable: number; restoreRate: number } } };
}

export async function shopifyGraphQL<T = unknown>(args: {
  shopDomain: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<ShopifyGraphQLResult<T>> {
  const apiVersion = Deno.env.get('SHOPIFY_API_VERSION') ?? DEFAULT_API_VERSION;
  const url = `https://${args.shopDomain}/admin/api/${apiVersion}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-shopify-access-token': args.accessToken,
      accept: 'application/json',
    },
    body: JSON.stringify({ query: args.query, variables: args.variables ?? {} }),
  });

  // Respect rate-limit headers if present. Caller may want to back off.
  // For MVP we just surface the error rather than auto-retry.
  if (res.status === 429) {
    return { errors: [{ message: 'shopify rate-limited (429)' }] };
  }
  if (!res.ok) {
    return { errors: [{ message: `shopify graphql http ${res.status}` }] };
  }
  return await res.json() as ShopifyGraphQLResult<T>;
}

export const QUERIES = {
  shopInfo: `query ShopInfo {
    shop {
      id
      name
      myshopifyDomain
      primaryDomain { host url }
      contactEmail
      currencyCode
      ianaTimezone
      plan { displayName partnerDevelopment shopifyPlus }
    }
  }`,

  themes: `query Themes {
    themes(first: 50) {
      edges { node { id name role processing themeStoreId } }
    }
  }`,

  // Optional: list installed apps. Returns minimal info — we use this to
  // spot tracking-app vendors (Klaviyo, Meta Pixel, etc.) by name.
  installedApps: `query InstalledApps {
    appInstallations(first: 100) {
      edges {
        node {
          id
          app { id title }
          launchUrl
        }
      }
    }
  }`,
};
