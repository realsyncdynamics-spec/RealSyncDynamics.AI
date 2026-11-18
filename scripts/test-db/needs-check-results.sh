#!/usr/bin/env bash
# Bedarfs-Check — Sicherheitstests gegen echtes Postgres (ohne Node-Abhängigkeiten).
#
# Prüft die Bedarfs-Check-Tabelle nach beiden Migrationen:
#   supabase/migrations/20261115200000_needs_check_results.sql (Erstfassung, #2262)
#   supabase/migrations/20261117190000_needs_check_results_hardening.sql (Härtung)
# Geprüft werden:
#   gefälschte Felder (user_id, created_at, model_version, Empfehlungen, id,
#   Scan-Referenz), fremde Ergebnisse, anon, UPDATE, verdeckte Kontingent-
#   Tabellen, Kontingent 20/24 h (sequenziell, nach Löschen, rollierend, nur
#   erfolgreiche Speicherungen), parallele Speicherungen (READ COMMITTED und
#   REPEATABLE READ), Kontokündigung, Parität SQL ↔ shared/needs-check.ts.
#
# Aufruf (leere Datenbank, Rechte wie in scripts/test-db/bootstrap.sql):
#   PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=… scripts/test-db/needs-check-results.sh
#
# Die Datenbank wird mit scripts/test-db/bootstrap.sql und der Migration
# vorbereitet, falls `needs_check_results` noch fehlt. Jeder Test legt eigene
# Nutzer an; Testdaten bleiben in der Datenbank (Wegwerf-DB verwenden).
#
# Der Vitest-Zwilling für die CI ist test/runtime/db/needs-check-results.db.test.ts.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIGRATIONS=(
  "$ROOT/supabase/migrations/20261115200000_needs_check_results.sql"
  "$ROOT/supabase/migrations/20261117190000_needs_check_results_hardening.sql"
)
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -tA)
pass=0
fail=0

ok()   { pass=$((pass + 1)); printf '  ✓ %s\n' "$1"; }
bad()  { fail=$((fail + 1)); printf '  ✗ %s\n    → %s\n' "$1" "$2"; }

admin() { "${PSQL[@]}" -c "$1" 2>&1; }

# Führt SQL als `authenticated` (oder anon) mit gesetzten JWT-Claims in einer
# eigenen Transaktion aus. Gibt stdout+stderr zurück.
as_role() {
  local role="$1" uid="$2" sql="$3" iso="${4:-read committed}" claims
  if [ -n "$uid" ]; then claims="{\"sub\":\"$uid\",\"role\":\"$role\"}"; else claims="{\"role\":\"$role\"}"; fi
  "${PSQL[@]}" 2>&1 <<SQL
BEGIN ISOLATION LEVEL ${iso};
SELECT set_config('request.jwt.claims', '${claims}', true) \\g /dev/null
SET LOCAL ROLE ${role};
${sql};
COMMIT;
SQL
}
as_user() { as_role authenticated "$1" "$2" "${3:-read committed}"; }

expect_err() { # name, output, pattern
  if grep -qiE "$3" <<<"$2"; then ok "$1"; else bad "$1" "erwartet Fehler /$3/, erhalten: $(head -c 300 <<<"$2")"; fi
}
expect_eq() { # name, actual, expected
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1" "erwartet '$3', erhalten '$(head -c 300 <<<"$2")'"; fi
}

new_user() { admin "INSERT INTO auth.users(email) VALUES ('nc_' || gen_random_uuid() || '@example.com') RETURNING id"; }

INS="INSERT INTO public.needs_check_results (goal, area, has_website) VALUES ('rules', 'kanzlei', false) RETURNING id"

# ── Vorbereitung ────────────────────────────────────────────────────────────
if [ "$(admin "SELECT to_regclass('public.needs_check_results') IS NOT NULL")" != "t" ]; then
  "${PSQL[@]}" -f "$ROOT/scripts/test-db/bootstrap.sql" >/dev/null || exit 2
  for m in "${MIGRATIONS[@]}"; do
    "${PSQL[@]}" -f "$m" >/dev/null 2>&1 || { echo "Migration fehlgeschlagen: $m"; exit 2; }
  done
fi

echo "1. Eigene Zeile und serverseitig gesetzte Felder"
A=$(new_user); B=$(new_user)
out=$(as_user "$A" "$INS")
if grep -qE '^[0-9a-f-]{36}$' <<<"$out"; then ok "eigener Nutzer darf speichern"; else bad "eigener Nutzer darf speichern" "$out"; fi
row=$(admin "SELECT user_id || '|' || model_version || '|' || array_to_string(recommendation_ids, ',') || '|' || (abs(extract(epoch FROM now() - created_at)) < 60) FROM public.needs_check_results WHERE user_id = '$A'")
expect_eq "user_id, Version, Empfehlungen und Zeit kommen vom Server" "$row" "$A|1|govern.runtime,build.new_site,automate.chat|true"

echo "2. Gefälschte Felder werden abgelehnt"
expect_err "fremde user_id"        "$(as_user "$A" "INSERT INTO public.needs_check_results (user_id, goal, area, has_website) VALUES ('$B', 'rules', 'kanzlei', false)")" "permission denied"
expect_err "eigener Zeitstempel"   "$(as_user "$A" "INSERT INTO public.needs_check_results (created_at, goal, area, has_website) VALUES (now() - interval '2 days', 'rules', 'kanzlei', false)")" "permission denied"
expect_err "eigene Empfehlungen"   "$(as_user "$A" "INSERT INTO public.needs_check_results (recommendation_ids, goal, area, has_website) VALUES (ARRAY['govern.runtime'], 'website', 'kanzlei', false)")" "permission denied"
expect_err "eigene Modellversion"  "$(as_user "$A" "INSERT INTO public.needs_check_results (model_version, goal, area, has_website) VALUES (2, 'rules', 'kanzlei', false)")" "permission denied"
expect_err "eigene id"             "$(as_user "$A" "INSERT INTO public.needs_check_results (id, goal, area, has_website) VALUES (gen_random_uuid(), 'rules', 'kanzlei', false)")" "permission denied"
expect_err "Scan-Referenz audit_id" "$(as_user "$A" "INSERT INTO public.needs_check_results (audit_id, goal, area, has_website) VALUES (gen_random_uuid(), 'rules', 'kanzlei', false)")" "permission denied"
expect_err "result_basis 'answers_and_scan'" "$(as_user "$A" "INSERT INTO public.needs_check_results (audit_id, result_basis, goal, area, has_website) VALUES (gen_random_uuid(), 'answers_and_scan', 'rules', 'kanzlei', false)")" "permission denied"
expect_eq "gespeicherte Zeile: keine Scan-Referenz" "$(admin "SELECT (audit_id IS NULL) || '|' || result_basis FROM public.needs_check_results WHERE user_id = '$A'")" "true|answers"
expect_err "ohne Identität (authenticated ohne sub)" "$(as_role authenticated "" "$INS")" "needs_check_unauthenticated"

echo "3. Ungültige Angaben scheitern am Server"
expect_err "unbekanntes Ziel"      "$(as_user "$A" "INSERT INTO public.needs_check_results (goal, area, has_website) VALUES ('alles', 'kanzlei', false)")" "needs_check_goal_chk|violates check"
expect_err "unbekannter Bereich"   "$(as_user "$A" "INSERT INTO public.needs_check_results (goal, area, has_website) VALUES ('rules', 'mars', false)")" "needs_check_area_chk"
expect_err "Adresse ohne Website"  "$(as_user "$A" "INSERT INTO public.needs_check_results (goal, area, has_website, website_url) VALUES ('rules', 'kanzlei', false, 'https://a.de')")" "needs_check_results_url_chk"
expect_err "Adresse mit Zugangsdaten" "$(as_user "$A" "INSERT INTO public.needs_check_results (goal, area, has_website, website_url) VALUES ('rules', 'kanzlei', true, 'https://user:pw@a.de')")" "needs_check_results_url_chk"
expect_err "Adresse zu lang"       "$(as_user "$A" "INSERT INTO public.needs_check_results (goal, area, has_website, website_url) VALUES ('rules', 'kanzlei', true, 'https://a.de/' || repeat('x', 300))")" "needs_check_results_url_chk"
expect_err "javascript:-Adresse"   "$(as_user "$A" "INSERT INTO public.needs_check_results (goal, area, has_website, website_url) VALUES ('rules', 'kanzlei', true, 'javascript:alert(1)')")" "needs_check_results_url_chk"

echo "4. Fremde Ergebnisse, anon, UPDATE, verdeckte Tabellen"
expect_eq "B sieht A nicht"         "$(as_user "$B" "SELECT count(*) FROM public.needs_check_results")" "0"
as_user "$B" "DELETE FROM public.needs_check_results WHERE user_id = '$A'" >/dev/null
expect_eq "B kann A nicht löschen"  "$(admin "SELECT count(*) FROM public.needs_check_results WHERE user_id = '$A'")" "1"
expect_err "UPDATE gesperrt (eigene Zeile)" "$(as_user "$A" "UPDATE public.needs_check_results SET goal = 'website'")" "permission denied"
expect_err "anon: lesen"            "$(as_role anon "" "SELECT count(*) FROM public.needs_check_results")" "permission denied"
expect_err "anon: speichern"        "$(as_role anon "" "$INS")" "permission denied"
expect_err "Protokoll lesen"        "$(as_user "$A" "SELECT count(*) FROM public.needs_check_save_log")" "permission denied"
expect_err "Protokoll löschen"      "$(as_user "$A" "DELETE FROM public.needs_check_save_log")" "permission denied"
expect_err "Protokoll fälschen"     "$(as_user "$A" "INSERT INTO public.needs_check_save_log (user_id, saved_at) VALUES ('$A', now() - interval '3 days')")" "permission denied"
expect_err "Sperrzeile ändern"      "$(as_user "$A" "DELETE FROM public.needs_check_save_quota")" "permission denied"
expect_err "Kontingent-Trigger nicht direkt aufrufbar" "$(as_user "$A" "SELECT public.needs_check_results_20_quota()")" "trigger functions can only be called as triggers|permission denied"

echo "5. Kontingent: 20 erfolgreiche Speicherungen je 24 Stunden"
Q=$(new_user)
okc=0; for _ in $(seq 1 20); do grep -qE '^[0-9a-f-]{36}$' <<<"$(as_user "$Q" "$INS")" && okc=$((okc + 1)); done
expect_eq "20 Speicherungen gelingen" "$okc" "20"
expect_err "die 21. scheitert"       "$(as_user "$Q" "$INS")" "needs_check_rate_limited"
as_user "$Q" "DELETE FROM public.needs_check_results" >/dev/null
expect_eq "Löschen entfernt die Ergebnisse" "$(admin "SELECT count(*) FROM public.needs_check_results WHERE user_id = '$Q'")" "0"
expect_err "Löschen gibt kein Kontingent frei" "$(as_user "$Q" "$INS")" "needs_check_rate_limited"
admin "UPDATE public.needs_check_save_log SET saved_at = saved_at - interval '24 hours 1 second' WHERE user_id = '$Q'" >/dev/null
out=$(as_user "$Q" "$INS")
if grep -qE '^[0-9a-f-]{36}$' <<<"$out"; then ok "nach 24 h ist das Kontingent wieder frei (rollierend)"; else bad "rollierendes Fenster" "$out"; fi
expect_eq "alte Protokollzeilen wurden entfernt" "$(admin "SELECT count(*) FROM public.needs_check_save_log WHERE user_id = '$Q'")" "1"
admin "UPDATE public.needs_check_save_log SET saved_at = now() - interval '23 hours' WHERE user_id = '$Q'" >/dev/null
admin "INSERT INTO public.needs_check_save_log (user_id, saved_at) SELECT '$Q', now() - interval '23 hours' FROM generate_series(1, 19)" >/dev/null
expect_err "Einträge von vor 23 h zählen noch" "$(as_user "$Q" "$INS")" "needs_check_rate_limited"

F=$(new_user)
for _ in 1 2 3 4 5; do as_user "$F" "INSERT INTO public.needs_check_results (goal, area, has_website) VALUES ('alles', 'kanzlei', false)" >/dev/null; done
expect_eq "fehlgeschlagene Speicherungen zählen nicht" "$(admin "SELECT count(*) FROM public.needs_check_save_log WHERE user_id = '$F'")" "0"
expect_eq "andere Nutzer haben eigenes Kontingent" "$(as_user "$B" "$INS" | grep -cE '^[0-9a-f-]{36}$')" "1"

echo "6. Parallele Speicherungen"
parallel_run() { # uid, isolation, n → schreibt Ausgaben nach $TMPD/p.*
  local uid="$1" iso="$2" n="$3" i
  rm -f "$TMPD"/p.*
  for i in $(seq 1 "$n"); do
    ( as_user "$uid" "$INS; SELECT pg_sleep(0.3);" "$iso" > "$TMPD/p.$i" ) &
  done
  wait
}
TMPD=$(mktemp -d)
P=$(new_user)
parallel_run "$P" "read committed" 30
expect_eq "READ COMMITTED, 30 parallel: genau 20 gespeichert" "$(admin "SELECT count(*) FROM public.needs_check_results WHERE user_id = '$P'")" "20"
expect_eq "READ COMMITTED: 10 abgelehnt mit Kontingent-Fehler" "$(grep -l needs_check_rate_limited "$TMPD"/p.* | wc -l | tr -d ' ')" "10"
expect_eq "Protokoll stimmt mit den Ergebnissen überein" "$(admin "SELECT count(*) FROM public.needs_check_save_log WHERE user_id = '$P'")" "20"
R=$(new_user)
parallel_run "$R" "repeatable read" 30
saved=$(admin "SELECT count(*) FROM public.needs_check_results WHERE user_id = '$R'")
if [ "$saved" -le 20 ] && [ "$saved" -ge 1 ]; then ok "REPEATABLE READ, 30 parallel: $saved gespeichert (≤ 20)"; else bad "REPEATABLE READ ≤ 20" "$saved"; fi
others=$(grep -lE "could not serialize|needs_check_rate_limited" "$TMPD"/p.* | wc -l | tr -d ' ')
expect_eq "REPEATABLE READ: alle übrigen scheitern (Serialisierung/Kontingent)" "$((saved + others))" "30"
rm -rf "$TMPD"

echo "7. Zweite Linie: CHECK auf die Empfehlungen"
out=$("${PSQL[@]}" 2>&1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"$B","role":"authenticated"}', true) \\g /dev/null
ALTER TABLE public.needs_check_results DISABLE TRIGGER needs_check_results_10_set_fields;
INSERT INTO public.needs_check_results (user_id, model_version, goal, area, has_website, recommendation_ids)
VALUES ('$B', 1, 'website', 'kanzlei', false, ARRAY['govern.runtime']);
ROLLBACK;
SQL
)
expect_err "falsche Empfehlungen scheitern auch ohne Trigger" "$out" "needs_check_results_recs_chk"
out=$("${PSQL[@]}" 2>&1 <<SQL
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"$B","role":"authenticated"}', true) \\g /dev/null
ALTER TABLE public.needs_check_results DISABLE TRIGGER needs_check_results_10_set_fields;
INSERT INTO public.needs_check_results (user_id, model_version, goal, area, has_website, recommendation_ids, audit_id, result_basis)
VALUES ('$B', 1, 'rules', 'kanzlei', false, public.needs_check_recommend(1::smallint, 'rules', false), gen_random_uuid(), 'answers_and_scan');
ROLLBACK;
SQL
)
expect_err "Scan-Referenz scheitert auch ohne Trigger" "$out" "needs_check_results_no_scan_chk"
expect_eq "alte Kontingent-Funktion ist entfernt" "$(admin "SELECT count(*) FROM pg_proc WHERE proname = 'needs_check_results_rate_limit'")" "0"
expect_err "unbekannte Modellversion: Fehler statt NULL" "$(admin "SELECT public.needs_check_recommend(2::smallint, 'rules', false)")" "needs_check_unknown_model_version"

echo "8. Kontolöschung"
admin "DELETE FROM auth.users WHERE id = '$Q'" >/dev/null
expect_eq "Ergebnisse, Protokoll und Sperrzeile gehen mit" "$(admin "SELECT (SELECT count(*) FROM public.needs_check_results WHERE user_id = '$Q') + (SELECT count(*) FROM public.needs_check_save_log WHERE user_id = '$Q') + (SELECT count(*) FROM public.needs_check_save_quota WHERE user_id = '$Q')")" "0"

echo "9. Parität SQL ↔ shared/needs-check.ts"
if node --version >/dev/null 2>&1; then
  ts=$(cd "$ROOT" && node --experimental-strip-types --no-warnings -e "
    import('./shared/needs-check.ts').then((m) => {
      for (const g of m.GOALS) for (const w of [true, false]) console.log(g + '|' + w + '|' + m.recommendIds({ goal: g, hasWebsite: w }).join(','));
    });")
  sql=$(admin "SELECT g || '|' || w || '|' || array_to_string(public.needs_check_recommend(1::smallint, g, w), ',')
               FROM unnest(ARRAY['website','inquiries','rules','unsure']) WITH ORDINALITY AS a(g, o),
                    unnest(ARRAY[true, false]) WITH ORDINALITY AS b(w, p) ORDER BY o, p")
  expect_eq "alle 8 Kombinationen identisch" "$sql" "$ts"
else
  bad "Parität" "node nicht verfügbar"
fi

echo
echo "Ergebnis: $pass bestanden, $fail fehlgeschlagen"
[ "$fail" -eq 0 ]
