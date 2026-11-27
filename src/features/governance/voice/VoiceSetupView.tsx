/**
 * Account-centered Voice onboarding handoff (frontend only).
 *
 * The current industry wizard is a separate static GitHub Pages origin.
 * Do not pass an Auth session, tenant ID, tokens, or configuration values to it.
 * It only generates local JSON/Markdown exports; there is no auto-save,
 * tenant provisioning, telephony activation, or Stripe purchase here.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Building2, FileDown, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { VOICE_PREVIEW_ONBOARDING_URL } from '../../../config/voice-onboarding';



export function VoiceSetupView() {
  const { activeTenantId, tenants, loading, error } = useTenant();
  const activeTenant = tenants.find((tenant) => tenant.tenantId === activeTenantId);

  return (
    <div className="min-h-full bg-obsidian-950 text-titanium-100" data-testid="voice-setup">
      <header className="border-b border-titanium-900 px-4 py-5 sm:px-6">
        <Link
          to="/app/voice"
          className="inline-flex items-center gap-2 text-xs text-titanium-400 hover:text-titanium-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zur Voice-Übersicht
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-titanium-50">Voice Agent vorbereiten</h1>
        <p className="mt-2 max-w-2xl text-sm text-titanium-400">
          Im bestehenden RealSync-Kundenkonto starten. Telefonie und automatische Bereitstellung sind nicht freigeschaltet.
        </p>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-titanium-400" data-testid="voice-setup-loading">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Workspace wird geladen…
          </div>
        ) : error ? (
          <div className="border border-rose-900 bg-rose-950/30 p-5 text-sm text-rose-200" role="alert" data-testid="voice-setup-error">
            Der Mandantenkontext ist nicht verfügbar. Der externe Konfigurator wird nicht aus diesem Workspace geöffnet.
          </div>
        ) : !activeTenant ? (
          <div className="border border-titanium-800 bg-obsidian-900 p-6 text-sm text-titanium-300" data-testid="voice-setup-no-tenant">
            Kein aktiver Mandant. Wählen oder erstellen Sie zuerst einen Workspace im gemeinsamen RealSync-Konto.
            <div className="mt-4"><Link className="text-security-300 underline" to="/app/dashboard">Zum Dashboard</Link></div>
          </div>
        ) : (
          <>
            <section className="border border-titanium-800 bg-obsidian-900 p-5" data-testid="voice-setup-tenant">
              <div className="flex items-start gap-3">
                <Building2 className="mt-1 h-5 w-5 shrink-0 text-security-300" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-semibold">Aktiver RealSync-Workspace</h2>
                  <p className="mt-1 text-sm text-titanium-300">{activeTenant.name}</p>
                  <p className="mt-2 text-xs leading-relaxed text-titanium-500">
                    Der Workspace wird nur zur Anzeige aus Ihrer bestehenden Mitgliedschaft geladen.
                    Seine Kennung und Ihre Anmeldung werden nicht an die externe Vorschauseite übergeben.
                  </p>
                </div>
              </div>
            </section>

            <section className="border border-titanium-800 bg-obsidian-900 p-5">
              <h2 className="text-base font-semibold">Konfiguration als Vorschau</h2>
              <ol className="mt-4 space-y-4 text-sm text-titanium-300">
                <li className="flex gap-3">
                  <span className="font-mono text-security-300">01</span>
                  <span>Öffnen Sie den vorhandenen Branchen- und Stimmen-Konfigurator auf GitHub Pages in einem neuen Tab.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-security-300">02</span>
                  <span>Geben Sie nur freigegebene Testdaten ein. Laden Sie den Entwurf bei Bedarf lokal als JSON oder Markdown herunter.</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-mono text-security-300">03</span>
                  <span>Die geprüfte Übernahme in Ihr RealSync-Konto ist ein separater Entwicklungsschritt. Der Download aktiviert keine Telefonie.</span>
                </li>
              </ol>
              <a
                href={VOICE_PREVIEW_ONBOARDING_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="voice-setup-open-preview"
                className="mt-6 inline-flex min-h-11 items-center gap-2 bg-security-700 px-5 py-3 text-sm font-semibold text-white hover:bg-security-600"
              >
                Bestehenden Konfigurator öffnen <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <p className="mt-3 text-xs text-titanium-500">
                Externe GitHub-Pages-Vorschau. Kein Single Sign-on, kein automatisches Speichern und kein Datentransfer aus dem RealSync-Konto.
              </p>
            </section>

            <section className="grid gap-3 md:grid-cols-3" aria-label="Freigabestatus">
              <div className="border border-titanium-800 p-4">
                <LockKeyhole className="h-5 w-5 text-security-300" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">Ein Konto</h3>
                <p className="mt-2 text-xs text-titanium-400">Die RealSync-Anmeldung schützt diesen Einstieg. Kein zweites Kundenkonto.</p>
              </div>
              <div className="border border-titanium-800 p-4">
                <FileDown className="h-5 w-5 text-security-300" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">Nur lokaler Entwurf</h3>
                <p className="mt-2 text-xs text-titanium-400">JSON/Markdown bleiben bei Ihnen. Keine ungeprüfte Übernahme in Supabase oder D1.</p>
              </div>
              <div className="border border-titanium-800 p-4">
                <ShieldCheck className="h-5 w-5 text-security-300" aria-hidden="true" />
                <h3 className="mt-3 text-sm font-semibold">Telefonie gesperrt</h3>
                <p className="mt-2 text-xs text-titanium-400">Kein Checkout, kein Provisioning, keine Nummer und keine Live-Schaltung über diesen Weg.</p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
