/**
 * Builder-02. `/build` is the one entry. The kind decides the engine;
 * the engines and their routes stay as they are.
 */

import { slugify } from '../../../packages/siteos-core/src/index';
import {
  BUILD_PROJECT_KINDS,
  surfaceHref,
  surfaceKindFor,
  type AppBuilderSlug,
  type BuildProjectKind,
} from './contract';

export const DEFAULT_BUILD_KIND: BuildProjectKind = 'website';

/** Maximum brief size for transient, same-tab navigation state. No prompt in the URL. */
export const CODE_ENTRY_PROMPT_MAX_CHARS = 8_000;

export interface CodeBuilderHandoffState {
  codeBuilderHandoff: {
    source: 'build-studio';
    prompt: string;
  };
}

/** Content handoff only. This is never an authentication or tenant claim. */
export function codeEntryState(description: string): CodeBuilderHandoffState | null {
  const prompt = description.trim();
  if (!prompt || prompt.length > CODE_ENTRY_PROMPT_MAX_CHARS) return null;
  return { codeBuilderHandoff: { source: 'build-studio', prompt } };
}

/** Ignore malformed/oversized state (including direct navigation without a handoff). */
export function readCodeEntryPrompt(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const value = (state as { codeBuilderHandoff?: unknown }).codeBuilderHandoff;
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { source?: unknown; prompt?: unknown };
  if (candidate.source !== 'build-studio' || typeof candidate.prompt !== 'string') return null;
  const prompt = candidate.prompt.trim();
  return prompt && prompt.length <= CODE_ENTRY_PROMPT_MAX_CHARS ? prompt : null;
}

export const BUILD_KIND_LABEL: Readonly<Record<BuildProjectKind, string>> = {
  landing: 'Landingpage',
  website: 'Website',
  web_app: 'Web-App',
  dashboard: 'Dashboard',
  saas_app: 'SaaS-App',
};

/** `?kind=` from old entries. Anything unknown keeps today's website flow. */
export function parseBuildKind(raw: string | null | undefined): BuildProjectKind {
  const value = raw?.trim().toLowerCase();
  return (BUILD_PROJECT_KINDS as readonly string[]).includes(value ?? '')
    ? (value as BuildProjectKind)
    : DEFAULT_BUILD_KIND;
}

/**
 * Where a code kind continues. Name first, else the opening words of the
 * description. Tenant and entitlement are checked by the code builder page.
 */
export function codeEntryHref(kind: BuildProjectKind, name: string, description = ''): string {
  if (surfaceKindFor(kind) !== 'code') {
    throw new Error(`${kind} stays in the SiteOS flow on /build`);
  }
  const source = name.trim() || description.trim().split(/\s+/).slice(0, 4).join(' ');
  // slugify falls back to 'site' when nothing survives (e.g. 日本). Keep such names apart.
  const base = slugify(source);
  const slug = (
    base === 'site' && !/site/i.test(source) ? (source ? `app-${shortHash(source)}` : 'app') : base
  ) as AppBuilderSlug;
  return surfaceHref({ kind: 'code', slug, route: '/builder/:slug/code' });
}

/** FNV-1a, 8 hex chars. Stable across sessions; not a security hash. */
function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
