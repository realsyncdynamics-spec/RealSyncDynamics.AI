import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  PRODUCTION_SUPABASE_URL,
  PRODUCTION_SUPABASE_ANON_KEY,
} from '../../src/lib/supabaseUrl';

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

describe('getSupabaseAnonKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses VITE_SUPABASE_ANON_KEY when set, trimmed', () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '  custom-anon-key  ');
    expect(getSupabaseAnonKey()).toBe('custom-anon-key');
  });

  it('falls back to the production anon key when the env var is empty', () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(getSupabaseAnonKey()).toBe(PRODUCTION_SUPABASE_ANON_KEY);
  });

  it('falls back to the production anon key when the env var is whitespace only', () => {
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '   ');
    expect(getSupabaseAnonKey()).toBe(PRODUCTION_SUPABASE_ANON_KEY);
  });
});
