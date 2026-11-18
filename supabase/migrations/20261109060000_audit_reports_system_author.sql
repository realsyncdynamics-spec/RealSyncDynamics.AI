-- audit_reports: Systemberichte ohne menschlichen Autor zulassen.
--
-- governance-score-calculator (pg_cron, stündlich) schreibt einen
-- automatischen Governance-Score-Bericht pro Tenant und Tag. Ein Cron-Job
-- hat keinen Nutzer in auth.users; einen Kundennutzer als Autor
-- einzutragen wäre ein falscher Herkunftsnachweis. Systemberichte tragen
-- daher created_by = NULL und report_scope = 'system:governance-score-daily'.
--
-- Nebenbei behebt das einen Widerspruch im Schema: Der Fremdschlüssel
-- audit_reports_created_by_fkey ist ON DELETE SET NULL, die Spalte war
-- aber NOT NULL — das Löschen eines Autors wäre bisher gescheitert.
--
-- Nicht destruktiv: lockert nur eine Constraint, keine Daten betroffen.

ALTER TABLE public.audit_reports
  ALTER COLUMN created_by DROP NOT NULL;

COMMENT ON COLUMN public.audit_reports.created_by IS
  'Autor (auth.users). NULL = Systembericht ohne menschlichen Autor, z. B. report_scope ''system:governance-score-daily''.';
