import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * #1297 hat welcome-email gesperrt. Dieser Schnitt verdrahtet den Signup,
 * ohne handle_new_auth_user anzufassen und ohne dispatch_cron_function
 * (die bei fehlendem Vault-Secret die Anmeldung sprengt).
 */

const SQL = readFileSync(
  'supabase/migrations/20260911140000_welcome_email_on_signup.sql',
  'utf8',
);
const code = SQL
  .split('\n')
  .filter((z) => !/^\s*--/.test(z))
  .join('\n');

describe('Welcome-Mail beim Signup ist fail-open verdrahtet', () => {
  it('legt try_dispatch_welcome_email an und fängt jeden Fehler', () => {
    expect(SQL).toContain('try_dispatch_welcome_email');
    expect(SQL).toMatch(/EXCEPTION WHEN OTHERS/);
    expect(SQL).toContain('welcome-email');
    expect(SQL).toContain('service_role_key');
  });

  it('benutzt nicht dispatch_cron_function (die RAISE EXCEPTION wirft)', () => {
    expect(code).not.toContain('dispatch_cron_function');
  });

  it('lässt handle_new_auth_user unangetastet', () => {
    expect(SQL).not.toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_auth_user/);
  });

  it('hängt AFTER INSERT auf auth.users hinter on_auth_user_created', () => {
    expect(SQL).toContain('on_auth_user_welcome_email');
    expect(SQL).toContain('AFTER INSERT ON auth.users');
    expect(SQL).toContain('EXECUTE FUNCTION public.dispatch_welcome_email()');
  });

  it('welcome-email bleibt hinter dem Service-Role-Bearer', () => {
    const src = readFileSync('supabase/functions/welcome-email/index.ts', 'utf8');
    expect(src).toMatch(/service role required/);
    expect(src).toMatch(/401/);
  });
});
