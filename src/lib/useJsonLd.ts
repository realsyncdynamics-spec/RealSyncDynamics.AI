import { useEffect } from 'react';

/**
 * Injects a JSON-LD script tag into <head> on mount and removes it on
 * unmount. Multiple calls in the same component register independent
 * scripts (different `id`s). Use the `id` arg to avoid duplicate
 * injection when the same component renders twice.
 *
 * No new dependency — the entire SPA-SEO surface uses this hook plus
 * `usePageMeta` instead of a heavyweight Helmet library.
 */
export function useJsonLd(id: string, data: unknown) {
  useEffect(() => {
    if (!id || !data) return;
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    el.textContent = JSON.stringify(data);
    document.head.appendChild(el);

    return () => {
      const e = document.getElementById(id);
      if (e) e.remove();
    };
  }, [id, JSON.stringify(data)]);
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function faqPageLd(faqs: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function breadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function softwareApplicationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RealSyncDynamics.AI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description:
      'Technische Vorprüfung und Monitoring für DSGVO-, TTDSG- und AI-Act-relevante Website- und Tracking-Risiken.',
    url: 'https://realsyncdynamicsai.de/',
  };
}
