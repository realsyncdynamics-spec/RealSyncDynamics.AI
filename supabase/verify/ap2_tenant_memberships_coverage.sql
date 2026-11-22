-- AP2 Pruef-SQL, nur lesend. Dominik kann das gegen Produktion laufen lassen.
-- Nicht vom Agenten gegen RealSyncDynamicsLive ausgefuehrt.
-- Keine personenbezogenen Freitexte: nur Schluessel, Rollen und Zaehlungen.
--
-- Lesart
--   fehlend_in_memberships > 0  -> Vorwaerts-Migration bricht ab (Bestandsschutz).
--   admin_rolle_weicht > 0      -> Quota-Mail an role = 'admin' wuerde den
--                                  Empfaenger verlieren oder wechseln.
--   Die Migration kopiert keine Zeilen. 'member' und 'viewer' passen nicht
--   in den memberships-Check (owner, admin, dpo, editor, viewer_auditor).

SELECT
  (SELECT count(*) FROM public.tenant_memberships) AS tenant_memberships_zeilen,
  (SELECT count(*) FROM public.memberships) AS memberships_zeilen,
  (SELECT count(*)
     FROM public.tenant_memberships tm
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m
       WHERE m.tenant_id = tm.tenant_id AND m.user_id = tm.user_id
    )) AS fehlend_in_memberships,
  (SELECT count(*)
     FROM public.tenant_memberships tm
     JOIN public.memberships m
       ON m.tenant_id = tm.tenant_id AND m.user_id = tm.user_id
    WHERE tm.role = 'admin' AND m.role IS DISTINCT FROM 'admin') AS admin_rolle_weicht;

-- Zeilen ohne Gegenstueck. user_id ist der Schluessel, keine Mailadresse.
SELECT tm.tenant_id, tm.user_id, tm.role AS rolle_alt, 'fehlt in memberships' AS befund
  FROM public.tenant_memberships tm
 WHERE NOT EXISTS (
   SELECT 1 FROM public.memberships m
    WHERE m.tenant_id = tm.tenant_id AND m.user_id = tm.user_id
 )
 ORDER BY tm.tenant_id, tm.user_id;

-- Rollenvergleich der vorhandenen Paare, inklusive des Admin-Mail-Falls.
SELECT
  tm.tenant_id,
  tm.user_id,
  tm.role AS rolle_tenant_memberships,
  m.role AS rolle_memberships,
  CASE
    WHEN tm.role = 'admin' AND m.role IS DISTINCT FROM 'admin'
      THEN 'quota-mail nur noch bei memberships.admin'
    WHEN tm.role = m.role THEN 'token gleich'
    WHEN tm.role = 'owner' AND m.role = 'owner' THEN 'token gleich'
    WHEN tm.role IN ('member', 'viewer') THEN 'existenz gilt, token hat kein Gegenstueck'
    ELSE 'rollen weichen ab, existenz gilt'
  END AS einordnung
  FROM public.tenant_memberships tm
  JOIN public.memberships m
    ON m.tenant_id = tm.tenant_id AND m.user_id = tm.user_id
 ORDER BY tm.tenant_id, tm.user_id;
