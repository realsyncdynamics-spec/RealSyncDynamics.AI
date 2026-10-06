// Cloudflare Pages Direct Upload for governed SiteOS preview releases.
//
// Contract verified against Cloudflare/Wrangler 2026:
//   upload-token -> check-missing -> upload -> upsert-hashes -> deployment manifest.
//
// This module never decides whether a release is publishable. It only transports
// files that were already produced by siteos/publish-export.
//
// IMPORTANT: Pages asset keys are not our SHA-256 evidence hashes. Wrangler uses
// BLAKE3(base64(file bytes) + file extension), truncated to 32 hex chars.
// Keep these two hash domains separate.

import { hash as blake3hash } from 'npm:blake3-wasm@2.1.5';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_BATCH_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BATCH_FILES = 500;

export interface ReleaseFile {
  path: string;
  content: string;
  sha256: string;
  bytes: number;
}

export interface PagesProjectRef {
  id: string;
  name: string;
  subdomain: string | null;
  productionBranch: string;
  created: boolean;
}

export interface PagesPreviewDeployment {
  id: string;
  url: string;
  environment: string | null;
  project: PagesProjectRef;
  branch: string;
  manifest: Record<string, string>;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
}

interface PagesProjectApi {
  id: string;
  name: string;
  subdomain?: string | null;
  production_branch?: string | null;
}

interface PagesDeploymentApi {
  id: string;
  url: string;
  environment?: string | null;
}

export class CloudflarePagesError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CloudflarePagesError';
    this.status = status;
    this.code = code;
  }
}

/** Same deterministic naming scheme already used by the legacy deployer. */
export function pagesProjectName(projectName: string, projectId: string): string {
  const base = projectName
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 44) || 'site';
  const suffix = projectId.replace(/[^a-fA-F0-9]/g, '').toLowerCase().slice(0, 8);
  return `${base}-${suffix || 'project'}`.slice(0, 58).replace(/-+$/g, '');
}

/**
 * Cloudflare Pages/Wrangler asset key.
 * This is intentionally NOT the SiteOS evidence SHA-256.
 */
export function pagesAssetHash(file: Pick<ReleaseFile, 'path' | 'content'>): string {
  const base64 = utf8ToBase64(file.content);
  const cleanPath = file.path.split('?')[0].split('#')[0];
  const name = cleanPath.slice(cleanPath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  const extension = dot >= 0 ? name.slice(dot + 1) : '';
  return blake3hash(base64 + extension).toString('hex').slice(0, 32);
}

export async function deployPagesPreview(args: {
  accountId: string;
  apiToken: string;
  projectId: string;
  projectName: string;
  artifactSha256: string;
  files: ReleaseFile[];
  fetchImpl?: typeof fetch;
}): Promise<PagesPreviewDeployment> {
  const fetchImpl = args.fetchImpl ?? fetch;
  if (!args.accountId || !args.apiToken) {
    throw new CloudflarePagesError(500, 'CLOUDFLARE_NOT_CONFIGURED', 'Cloudflare credentials missing');
  }
  validateReleaseFiles(args.files);

  const cfName = pagesProjectName(args.projectName, args.projectId);
  const project = await ensurePagesProject(fetchImpl, args.accountId, args.apiToken, cfName);
  const uploadJwt = await getUploadToken(fetchImpl, args.accountId, args.apiToken, project.name);

  const prepared = args.files.map((file) => ({
    file,
    hash: pagesAssetHash(file),
    contentType: contentTypeForPath(file.path),
  }));
  const hashes = prepared.map((item) => item.hash);

  const missing = await pagesJwtRequest<string[]>(
    fetchImpl,
    uploadJwt,
    '/pages/assets/check-missing',
    { method: 'POST', body: JSON.stringify({ hashes }) },
  );
  const missingSet = new Set(missing);

  const toUpload = prepared.filter((item) => missingSet.has(item.hash));
  for (const batch of makeUploadBatches(toUpload)) {
    await pagesJwtRequest<unknown>(
      fetchImpl,
      uploadJwt,
      '/pages/assets/upload',
      {
        method: 'POST',
        body: JSON.stringify(batch.map(({ file, hash, contentType }) => ({
          key: hash,
          value: utf8ToBase64(file.content),
          metadata: { contentType },
          base64: true,
        }))),
      },
    );
  }

  // Cache optimization only. Wrangler treats failure here as non-fatal too:
  // uploaded assets are already valid for this deployment.
  try {
    await pagesJwtRequest<unknown>(
      fetchImpl,
      uploadJwt,
      '/pages/assets/upsert-hashes',
      { method: 'POST', body: JSON.stringify({ hashes }) },
    );
  } catch (error) {
    console.warn(JSON.stringify({
      level: 'warn',
      scope: 'siteos_pages_upsert_hashes_failed',
      error: error instanceof Error ? error.message : String(error),
    }));
  }

  const manifest = Object.fromEntries(prepared.map(({ file, hash }) => [normalizeDeployPath(file.path), hash]));
  const branch = `preview-${args.artifactSha256.slice(0, 12)}`;
  if (project.productionBranch === branch) {
    throw new CloudflarePagesError(
      409,
      'PREVIEW_BRANCH_IS_PRODUCTION',
      'Cloudflare project production branch collides with the governed preview branch',
    );
  }

  // Preview branch only. Production branch remains "main" and is never used
  // by this helper.
  const form = new FormData();
  form.set('manifest', JSON.stringify(manifest));
  form.set('branch', branch);
  form.set('commit_dirty', 'false');
  form.set('commit_message', `SiteOS governed preview ${args.artifactSha256.slice(0, 12)}`);

  const deployment = await cfRequest<PagesDeploymentApi>(
    fetchImpl,
    `/accounts/${encodeURIComponent(args.accountId)}/pages/projects/${encodeURIComponent(project.name)}/deployments`,
    args.apiToken,
    { method: 'POST', body: form },
  );

  if (!deployment || !deployment.id || !deployment.url) {
    throw new CloudflarePagesError(502, 'CLOUDFLARE_BAD_RESPONSE', 'Cloudflare deployment response lacked id/url');
  }

  return {
    id: deployment.id,
    url: deployment.url,
    environment: deployment.environment ?? null,
    project,
    branch,
    manifest,
  };
}

async function ensurePagesProject(
  fetchImpl: typeof fetch,
  accountId: string,
  apiToken: string,
  projectName: string,
): Promise<PagesProjectRef> {
  const path = `/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}`;
  const existing = await cfRequest<PagesProjectApi>(fetchImpl, path, apiToken, { method: 'GET' }, true);
  if (existing) {
    return {
      id: existing.id,
      name: existing.name || projectName,
      subdomain: existing.subdomain ?? null,
      productionBranch: existing.production_branch || 'main',
      created: false,
    };
  }

  const created = await cfRequest<PagesProjectApi>(
    fetchImpl,
    `/accounts/${encodeURIComponent(accountId)}/pages/projects`,
    apiToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: projectName, production_branch: 'main' }),
    },
  );
  if (!created) {
    throw new CloudflarePagesError(502, 'CLOUDFLARE_BAD_RESPONSE', 'Cloudflare project creation returned no project');
  }
  return {
    id: created.id,
    name: created.name || projectName,
    subdomain: created.subdomain ?? null,
    productionBranch: created.production_branch || 'main',
    created: true,
  };
}

async function getUploadToken(
  fetchImpl: typeof fetch,
  accountId: string,
  apiToken: string,
  projectName: string,
): Promise<string> {
  const result = await cfRequest<{ jwt: string }>(
    fetchImpl,
    `/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/upload-token`,
    apiToken,
    { method: 'GET' },
  );
  if (!result || !result.jwt) {
    throw new CloudflarePagesError(502, 'CLOUDFLARE_BAD_RESPONSE', 'Cloudflare upload-token response lacked jwt');
  }
  return result.jwt;
}

async function cfRequest<T>(
  fetchImpl: typeof fetch,
  path: string,
  apiToken: string,
  init: RequestInit,
  allowNotFound = false,
): Promise<T | null> {
  const response = await fetchImpl(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(init.headers ?? {}),
    },
  });

  const envelope = await readEnvelope<T>(response);
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok || !envelope.success) {
    throw cloudflareError(response.status, envelope);
  }
  return envelope.result;
}

async function pagesJwtRequest<T>(
  fetchImpl: typeof fetch,
  jwt: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetchImpl(`${CF_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const envelope = await readEnvelope<T>(response);
  if (!response.ok || !envelope.success) {
    throw cloudflareError(response.status, envelope);
  }
  return envelope.result;
}

async function readEnvelope<T>(response: Response): Promise<CloudflareEnvelope<T>> {
  try {
    return await response.json() as CloudflareEnvelope<T>;
  } catch {
    throw new CloudflarePagesError(
      response.status || 502,
      'CLOUDFLARE_INVALID_RESPONSE',
      'Cloudflare returned a non-JSON response',
    );
  }
}

function cloudflareError<T>(status: number, envelope: CloudflareEnvelope<T>): CloudflarePagesError {
  const first = envelope.errors?.[0];
  return new CloudflarePagesError(
    status || 502,
    first?.code ? `CLOUDFLARE_${first.code}` : 'CLOUDFLARE_API_ERROR',
    first?.message || 'Cloudflare API request failed',
  );
}

function validateReleaseFiles(files: ReleaseFile[]): void {
  if (!Array.isArray(files) || files.length === 0) {
    throw new CloudflarePagesError(400, 'EMPTY_ARTIFACT', 'Release artifact contains no files');
  }
  if (files.length > MAX_FILES) {
    throw new CloudflarePagesError(413, 'TOO_MANY_FILES', `Release exceeds ${MAX_FILES} files`);
  }

  const seen = new Set<string>();
  for (const file of files) {
    const path = normalizeDeployPath(file.path);
    if (seen.has(path)) {
      throw new CloudflarePagesError(400, 'DUPLICATE_PATH', `Duplicate release path: ${path}`);
    }
    seen.add(path);
    const actualBytes = new TextEncoder().encode(file.content).byteLength;
    if (actualBytes !== file.bytes) {
      throw new CloudflarePagesError(409, 'ARTIFACT_SIZE_MISMATCH', `Byte length mismatch for ${path}`);
    }
    if (actualBytes > MAX_FILE_BYTES) {
      throw new CloudflarePagesError(413, 'FILE_TOO_LARGE', `${path} exceeds 25 MiB`);
    }
  }
}

function makeUploadBatches<T extends { file: ReleaseFile }>(files: T[]): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let bytes = 0;

  for (const item of files) {
    if (
      current.length > 0
      && (current.length >= MAX_UPLOAD_BATCH_FILES || bytes + item.file.bytes > MAX_UPLOAD_BATCH_BYTES)
    ) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += item.file.bytes;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function normalizeDeployPath(path: string): string {
  const trimmed = String(path || '').trim();
  if (!trimmed || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new CloudflarePagesError(400, 'INVALID_PATH', `Invalid release path: ${trimmed}`);
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function contentTypeForPath(path: string): string {
  const clean = path.toLowerCase().split('?')[0].split('#')[0];
  if (clean.endsWith('.html')) return 'text/html; charset=utf-8';
  if (clean.endsWith('.css')) return 'text/css; charset=utf-8';
  if (clean.endsWith('.js') || clean.endsWith('.mjs')) return 'text/javascript; charset=utf-8';
  if (clean.endsWith('.json')) return 'application/json; charset=utf-8';
  if (clean.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.txt')) return 'text/plain; charset=utf-8';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(binary);
}
