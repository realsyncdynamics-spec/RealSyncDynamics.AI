import { describe, it, expect, afterEach, vi } from 'vitest';
import { getSupabaseUrl, PRODUCTION_SUPABASE_URL } from '../../src/lib/supabaseUrl';

describe('getSupabaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses VITE_SUPABASE_URL when set, without trailing slash', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://custom.supabase.co/');
    expect(getSupabaseUrl()).toBe('https://custom.supabase.co');
  });

  it('falls back to the production URL when the env var is empty', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(getSupabaseUrl()).toBe(PRODUCTION_SUPABASE_URL);
  });

  it('falls back to the production URL when the env var is whitespace only', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '   ');
    expect(getSupabaseUrl()).toBe(PRODUCTION_SUPABASE_URL);
  });
});
