-- tenant_onboarding — Journey-Zustand VOR dem Kauf
--
-- BEFUND (2026-09-27 am Repo-Schema gemessen, nicht hergeleitet)
--
-- Es gibt heute keinen Ort fuer den Onboarding-Fortschritt eines
-- Interessenten, BEVOR er bezahlt hat. `customer_onboarding` ist dafuer
-- ungeeignet und war nie dafuer gedacht: `stripe_session_id` ist dort
-- `not null unique`, und die Zeile entsteht ausschliesslich im
-- `stripe-webhook` beim Ereignis `checkout.session.completed`
-- (supabase/functions/stripe-webhook/index.ts, idempotenter Upsert auf
-- ebendiese Spalte). Die Migration 20260808100000 schreibt es selbst hin:
-- "customer_onboarding ist ein Stripe-Session-Log ohne tenant_id".
--
-- Damit steht die Datenlage genau andersherum als der Zielablauf
-- (Einstieg -> Konto -> Onboarding -> Checkout -> Dashboard): Onboarding-
-- Zustand entsteht erst NACH dem Kauf. Der Journey-Resolver
-- (src/core/journey/resolveCustomerDestination.ts, seit PR #1493 auf main)
-- kann seine Sprossen "Onboarding unvollstaendig" und "Checkout offen" fuer
-- einen unbezahlten Interessenten deshalb gar nicht auswerten — es gibt
-- keine Zeile, die sie belegen koennte.
--
-- ENTSCHEIDUNG: eigene, mandantengebundene Tabelle statt Erweiterung von
-- `customer_onboarding`. `stripe_session_id` dort nullable zu machen wuerde
-- einen Vertrag des Zahlungspfads aufweichen, an dem ein aktiver
-- Schreibpfad haengt — und der Upsert des Webhooks stuetzt sich genau auf
-- dessen Eindeutigkeit. Additiv daneben ist billiger, rueckholbar und
-- beruehrt den Zahlungspfad nicht.
--
-- ADDITIV: keine bestehende Tabelle, Spalte, Funktion oder Policy wird
-- veraendert.
--
-- Compliance
--   DSGVO Art. 5 (1) c (Datenminimierung): nur, was die spaetere
--     Konfiguration bestimmt — Branche, Systeme, gewaehlter Plan. Keine
--     Inhaltsdaten, keine Zahlungsdaten. Loeschung des Mandanten entfernt
--     die Zeile per ON DELETE CASCADE.
--   EU AI Act Art. 12 (Aufzeichnung): `answers` haelt fest, auf welchen
--     Angaben eine spaeter empfohlene Governance-Konfiguration beruhte.

CREATE TABLE IF NOT EXISTS public.tenant_onboarding (
  -- Ein Journey-Zustand je Mandant. Primaerschluessel statt eigener id:
  -- Der Zustand IST der des Mandanten, eine zweite Zeile waere ein Widerspruch
  -- (dieselbe Begruendung wie UNIQUE(tenant_id) auf `subscriptions`).
  tenant_id           uuid        PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

  status              text        NOT NULL DEFAULT 'in_progress',
  step                smallint    NOT NULL DEFAULT 1,

  -- Gewaehlt, aber noch nicht bezahlt. Genau der Zustand, den es bisher
  -- nirgends gibt: `subscriptions` entsteht erst mit der Zahlung.
  selected_plan_key   text,

  -- Bruecke zu `customer_onboarding`, sobald ein Checkout laeuft. Bewusst
  -- ohne Fremdschluessel: die Stripe-Session existiert dort erst, wenn der
  -- Webhook sie angelegt hat — ein FK wuerde die Wiederaufnahme eines
  -- abgebrochenen Checkouts verhindern, also genau den Fall, fuer den das
  -- Feld da ist.
  checkout_session_id text,

  -- Antworten des gefuehrten Ablaufs (Branche, Anwendungsfall, Systeme).
  answers             jsonb       NOT NULL DEFAULT '{}'::jsonb,

  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tenant_onboarding_status_check
    CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  CONSTRAINT tenant_onboarding_step_check
    CHECK (step >= 1),

  -- Invariante statt Konvention: "fertig" und der Zeitpunkt gehoeren
  -- zusammen. Ohne diesen CHECK koennte eine Zeile `completed` heissen und
  -- kein `completed_at` tragen — der Resolver liest genau `completed_at`
  -- und wuerde den Kunden dann ewig ins Onboarding zurueckschicken.
  CONSTRAINT tenant_onboarding_completed_consistency
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

COMMENT ON TABLE public.tenant_onboarding IS
  'Journey-Zustand eines Mandanten vor und waehrend des Onboardings. Schreibzugriff nur via service_role (Edge Functions). Nicht zu verwechseln mit customer_onboarding — das ist der Stripe-Session-Log nach dem Kauf.';

COMMENT ON COLUMN public.tenant_onboarding.selected_plan_key IS
  'Gewaehlter, noch nicht bezahlter Plan. Der bezahlte Plan steht in subscriptions.plan_key.';

-- ─── updated_at ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_tenant_onboarding_updated_at ON public.tenant_onboarding;
CREATE TRIGGER set_tenant_onboarding_updated_at
  BEFORE UPDATE ON public.tenant_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_onboarding ENABLE ROW LEVEL SECURITY;

-- Lesen: Mitglieder des Mandanten.
-- WARUM ueber is_tenant_member() und nicht per Join auf memberships:
-- SECURITY DEFINER vermeidet die RLS-Rekursion, die 20260723000001
-- abgeschafft hat.
DROP POLICY IF EXISTS tenant_onboarding_member_read ON public.tenant_onboarding;
CREATE POLICY tenant_onboarding_member_read ON public.tenant_onboarding
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- KEINE INSERT/UPDATE/DELETE-Policy, und das ist der Sicherheitskern dieser
-- Tabelle: `status` entscheidet spaeter mit darueber, ob jemand am Checkout
-- vorbei ins Dashboard gelangt. Wer die Spalte selbst setzen kann, setzt sich
-- selbst auf 'completed'. Geschrieben wird ausschliesslich aus Edge Functions
-- mit service_role — dieselbe Trennung, die Gate 0 (20260927120000) fuer die
-- uebrigen Governance-Tabellen festgelegt hat.
-- ZUERST ENTZIEHEN, DANN GEBEN — und das ist kein Zierrat:
-- `ALTER DEFAULT PRIVILEGES` vergibt in Supabase (und im CI-Bootstrap) an
-- JEDE neu erzeugte Tabelle in `public` automatisch
-- SELECT/INSERT/UPDATE/DELETE an anon und authenticated. Ein blosses
-- `GRANT SELECT` waere hier wirkungslos gewesen: Die Tabelle traegt die
-- Schreibrechte bereits ab ihrer Erzeugung. Gemessen am 2026-09-27 gegen
-- das Bootstrap-Schema — `authenticated` hatte alle vier Rechte.
--
-- Ohne diesen REVOKE haengt die Zusage allein an der fehlenden
-- Schreib-Policy. Das genuegt heute, faellt aber in dem Moment, in dem
-- jemand eine `FOR ALL`-Policy ergaenzt — genau die Klasse Befund, die
-- Gate 0 (20260927120000) fuer die uebrigen Tabellen abgeraeumt hat.
REVOKE ALL ON public.tenant_onboarding FROM anon, authenticated;
GRANT SELECT ON public.tenant_onboarding TO authenticated;
