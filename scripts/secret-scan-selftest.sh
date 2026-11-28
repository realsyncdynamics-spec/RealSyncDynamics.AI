#!/usr/bin/env bash
# Selbsttest für den Secret-Scan (AP-0.9). Prüft mit synthetischen Werten, dass
#  1. echte Schlüsselformate von der ERWARTETEN Regel erkannt werden (RuleID, nicht nur Exit-Code),
#  2. Platzhalter keinen Alarm auslösen,
#  3. Inline-Ausnahmen (gitleaks:allow) nicht wirken,
#  4. .gitleaksignore nur exakte Fingerprints enthält,
#  5. .gitleaks.toml keine globalen Ausnahmen oder deaktivierten Regeln enthält.
# Alle schlüsselähnlichen Werte entstehen zur Laufzeit aus Teilstücken; diese Datei
# selbst darf vom Scanner nicht gemeldet werden (wird in Schritt 6 geprüft).
set -euo pipefail
GL="${GITLEAKS:-gitleaks}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CFG="${SECRET_SCAN_CONFIG:-$ROOT/.gitleaks.toml}"
IGN="${SECRET_SCAN_IGNORE:-$ROOT/.gitleaksignore}"
fail=0; pass=0
check() { if [ "$2" = "$3" ]; then pass=$((pass+1)); echo "PASS - $1"; else fail=$((fail+1)); echo "FAIL - $1 (erwartet $3, war $2)"; fi; }
rnd() { python3 -I -c 'import secrets,string,sys;print("".join(secrets.choice(string.ascii_letters+string.digits) for _ in range(int(sys.argv[1]))))' "$1"; }
b64u() { printf '%s' "$1" | base64 -w0 | tr '+/' '-_' | tr -d '='; }
SK="sk_""live_"; SB="sb_""secret_"; ANT="sk-""ant-api03-"; GH="gh""p_"

# Gibt die gemeldeten RuleIDs (sortiert, eindeutig, komma-getrennt) zurück; leer = kein Fund.
rules_for() {
  local d r; d="$(mktemp -d)"; r="$d.json"
  git -C "$d" init -q && git -C "$d" config user.email t@t && git -C "$d" config user.name t
  printf '%s\n' "$1" > "$d/config.ts" && git -C "$d" add . && git -C "$d" commit -qm t
  "$GL" git --no-banner --log-level error --redact --ignore-gitleaks-allow --config "$CFG" \
    --report-format json --report-path "$r" --exit-code 0 "$d" >/dev/null 2>&1
  python3 -I -c 'import json,sys;print(",".join(sorted({x["RuleID"] for x in json.load(open(sys.argv[1]))})))' "$r"
}
has_rule() { case ",$1," in *",$2,"*) echo yes;; *) echo no;; esac; }

# 1) Positivtests – exakt die erwartete Regel muss anschlagen
check "Stripe Live Secret -> stripe-access-token"  "$(has_rule "$(rules_for "const k = '${SK}$(rnd 32)';")" stripe-access-token)" yes
check "Supabase Secret -> supabase-secret-key"     "$(has_rule "$(rules_for "const k = '${SB}$(rnd 31)';")" supabase-secret-key)" yes
check "Anthropic Key -> anthropic-api-key"         "$(has_rule "$(rules_for "const k = '${ANT}$(rnd 93)AA';")" anthropic-api-key)" yes
check "GitHub Token -> github-pat"                 "$(has_rule "$(rules_for "const k = '${GH}$(rnd 36)';")" github-pat)" yes
REF="$(rnd 20 | tr 'A-Z' 'a-z')"
for P in "{\"iss\":\"supabase\",\"ref\":\"$REF\",\"role\":\"service_role\",\"iat\":1700000000}" \
         "{\"role\":\"service_role\",\"iss\":\"supabase\"}" \
         "{\"ref\":\"$REF\", \"role\": \"service_role\"}" ; do
  J="$(b64u '{"alg":"HS256","typ":"JWT"}').$(b64u "$P").$(rnd 43)"
  check "service_role-JWT -> supabase-service-role-jwt (${P:0:24}…)" "$(has_rule "$(rules_for "KEY=$J")" supabase-service-role-jwt)" yes
done
KEYFILE="$(mktemp)"; openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$KEYFILE" 2>/dev/null
check "Privater Schlüssel -> private-key"          "$(has_rule "$(rules_for "$(cat "$KEYFILE")")" private-key)" yes
rm -f "$KEYFILE"

# 2) Negativtests – kein Fund
check "Gekürzter Platzhalter kein Fund"  "$(rules_for "STRIPE_SECRET_KEY=${SK}...")" ""
check "Leerer Wert kein Fund"            "$(rules_for "STRIPE_SECRET_KEY=")" ""
check "Env-Referenz kein Fund"           "$(rules_for 'const k = process.env.SUPABASE_SERVICE_ROLE_KEY;')" ""
check "anon-JWT nicht als service_role"  "$(has_rule "$(rules_for "KEY=$(b64u '{"alg":"HS256"}').$(b64u '{"iss":"supabase","role":"anon"}').$(rnd 43)")" supabase-service-role-jwt)" no

# 3) Inline-Ausnahme darf nicht wirken
check "gitleaks:allow wird ignoriert"     "$(has_rule "$(rules_for "const k = '${SK}$(rnd 32)'; // gitleaks"":allow")" stripe-access-token)" yes

# 4) .gitleaksignore nur exakte Fingerprints
bad="$(grep -vE '^(#|$)' "$IGN" | grep -cvE '^[0-9a-f]{40}:.+:[a-z0-9-]+:[0-9]+$' || true)"
check ".gitleaksignore nur exakte Fingerprints" "$bad" 0

# 5) Keine globalen Ausnahmen, keine deaktivierten Regeln
check "Keine Allowlist/disabledRules in .gitleaks.toml" "$(grep -ciE '^\s*(\[\[?allowlists?\]\]?|disabledRules|paths\s*=|regexTarget)' "$CFG" || true)" 0

# 6) Diese Datei und die Konfiguration selbst lösen keinen Fund aus
SELF="$(mktemp -d)"; cp "$0" "$CFG" "$SELF/"
check "Selbsttest-Datei ohne Fund" "$("$GL" dir --no-banner --log-level error --redact --ignore-gitleaks-allow --config "$CFG" --exit-code 1 "$SELF" >/dev/null 2>&1; echo $?)" 0

echo; echo "$pass/$((pass+fail)) bestanden"; [ "$fail" -eq 0 ]
