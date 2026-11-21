-- Rollback RSD-011. Nur nach angewendeter Forward-Migration verwenden.
-- Nicht auf Live anwenden, solange die Forward-Migration nicht angewendet wurde.

DROP TRIGGER IF EXISTS trg_audit_create_drip ON public.gdpr_audits;

DROP FUNCTION IF EXISTS public.audit_email_drip_due(integer);
DROP FUNCTION IF EXISTS public.audit_email_drip_advance(uuid, text);
DROP FUNCTION IF EXISTS public.audit_email_drip_create_for_audit();

-- Tabelle nur droppen, wenn sie leer ist — keine Produktionsdaten loeschen,
-- falls zwischen Apply und Rollback bereits Drip-Zeilen entstanden sind.
DO $$
BEGIN
  IF to_regclass('public.audit_email_drip') IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_email_drip) THEN
    RAISE NOTICE 'RSD-011 Rollback: public.audit_email_drip hat Zeilen — Tabelle bleibt stehen; Funktionen und Trigger sind entfernt. Manuell: DROP TABLE public.audit_email_drip;';
  ELSE
    DROP TABLE public.audit_email_drip;
  END IF;
END
$$;
