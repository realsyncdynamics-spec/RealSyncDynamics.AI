import type { DesignVariantId, Industry } from './design-variants';

export type ServiceItem = {
  type: "service";
  title: string;
  description: string;
};

export type SiteDiscovery = {
  url: string;
  host: string;
  fetched: boolean;
  status: number | null;
  title: string;
  description: string;
  company: string;
  headings: string[];
  paragraphs: string[];
  services: ServiceItem[];
  nav: string[];
  emails: string[];
  phones: string[];
  address: string | null;
  hours: string | null;
  hasImpressum: boolean;
  hasDatenschutz: boolean;
  themeColor: string | null;
  missing: string[];
  industry: Industry;
  photos: string[];
};

export type RebuildPageId = "home" | "leistungen" | "ueber" | "kontakt" | "recht";

export type RebuildVersion = {
  id: string;
  at: string;
  variant: DesignVariantId;
  html: string;
  note: string;
};

export type QualityCheck = {
  id: string;
  group: "content" | "ui" | "seo" | "legal" | "security";
  label: string;
  ok: boolean;
  detail: string;
};
