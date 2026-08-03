-- Korrigiert die dokumentierte Semantik von page_views.visitor_hash /
-- .session_hash und hält sie erstmals als echte Spaltenkommentare in der DB.
--
-- Hintergrund: `session_hash` wurde in `track-pageview` als sha256(ip + ua)
-- ohne Tagesbestandteil gebildet. Der Spaltenkommentar der Ursprungsmigration
-- (20260506120000_page_views.sql) beschrieb dagegen einen tagesbezogenen Wert.
-- Faktisch war es ein über die Aufbewahrungsfrist von 90 Tagen stabiles
-- Wiedererkennungsmerkmal für dieselbe IP-/User-Agent-Kombination.
--
-- Die Funktion bildet ab jetzt beide Werte als
--   HMAC-SHA256(PAGEVIEW_HASH_SALT, scope + ip + user-agent + UTC-Tag)
-- und begrenzt sie damit auf einen Kalendertag. Rein dokumentierende
-- Migration — kein Schemaeingriff, keine RLS-Änderung, keine Datenmigration.
--
-- Bestandsdaten: vor dem Deploy geschriebene Zeilen tragen weiterhin die alten,
-- ungesalzenen Werte. Sie verfallen mit dem bestehenden 90-Tage-Cleanup
-- ('page-views-cleanup-daily'). Hashes über die Umstellung hinweg sind
-- absichtlich nicht vergleichbar: Salt und Konstruktion haben gewechselt.

COMMENT ON COLUMN public.page_views.visitor_hash IS
  'HMAC-SHA256(PAGEVIEW_HASH_SALT, ''visitor'' + ip + user-agent + UTC-Tag). '
  'Gleicher Besucher am gleichen Tag = gleicher Wert; über Tagesgrenzen hinweg '
  'nicht wiedererkennbar.';

COMMENT ON COLUMN public.page_views.session_hash IS
  'HMAC-SHA256(PAGEVIEW_HASH_SALT, ''session'' + ip + user-agent + UTC-Tag). '
  'Gruppierung von Pageviews innerhalb eines Kalendertags (Funnel). Trägt '
  'denselben Tagesbestandteil wie visitor_hash und ist damit ebenfalls nicht '
  'tagesübergreifend verknüpfbar.';

COMMENT ON TABLE public.page_views IS
  'DSGVO-konforme Visitor-Analytics. visitor_hash/session_hash = '
  'HMAC-SHA256(Salt, scope+ip+ua+Tag), löscht sich selbst nach 90d.';
