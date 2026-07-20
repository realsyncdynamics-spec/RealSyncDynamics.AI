# Development Setup & Code Quality

Dieses Dokument beschreibt die Einstellungen und Tools für Entwicklung, Code-Qualität und Deployment.

## 📦 Installation & Initialisierung

```bash
npm install
npx husky install
```

## ✅ Code Quality Checks

### Pre-Commit Hooks (Automatisch)

Vor jedem Git-Commit werden diese Checks automatisch ausgeführt:

1. **Prettier** — Code-Formatierung
2. **ESLint** — Linting (Fehler, Best-Practices)
3. **TypeScript** — Type-Checking (strict mode)

```bash
# Wird automatisch vor git commit ausgeführt:
npm run lint              # TypeScript check
prettier --write "..."    # Code formatieren
eslint --fix "..."        # ESLint errors beheben
```

### Manuelle Checks

```bash
# TypeScript type-checking
npm run lint

# Code formatieren (alle Dateien)
npx prettier --write .

# ESLint beheben
npx eslint --fix src/

# Tests
npm test
npm run e2e
npm run check:production
```

## 🔐 Environment Variablen

### Struktur

- **`.env.example`** — Template mit allen Variablen (committet)
- **`.env.local`** — Lokale Entwicklung (gitignored, NICHT committen)
- **`.env.production`** — Production-Template (committet, keine Secrets)

### Setup für Entwicklung

```bash
# 1. Vorlage kopieren
cp .env.example .env.local

# 2. Werte eintragen (NIEMALS commiten)
# z.B. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.
```

### Secrets in Production

- **Service-Role-Keys** → Nur in Edge Functions (Supabase Secrets)
- **Stripe Keys** → GitHub Secrets → CI/CD → Supabase Secrets
- **API Keys** → Umgebungsvariablen in Deployment-Plattform

**Regel**: Niemals Secrets ins Git committen. `.env.local` ist gitignored.

## 🎯 TypeScript Strict Mode

TypeScript ist im **strict mode** aktiviert (`tsconfig.json: strict: true`):

- ✅ Alle Parameter müssen typisiert sein
- ✅ Keine `implicit any`
- ✅ Null-checks erzwungen
- ✅ Bessere IDE-Unterstützung

### Wenn `tsc --noEmit` fehlschlägt:

```bash
# Fehler ansehen
npm run lint

# Dann beheben (z.B. Type-Annotationen hinzufügen)
# Falls nötig, mit Team klären
```

## 🚀 Entwicklungs-Workflow

### 1. Feature-Branch erstellen

```bash
git checkout -b feature/my-feature
```

### 2. Entwickeln

```bash
npm run dev
```

### 3. Vor dem Commit

```bash
# Auto-Checks laufen vor jedem Commit
git add .
git commit -m "feat: my feature"
# ← Husky führt lint-staged aus
# ← Bei Fehlern: fixt oder bricht ab
```

### 4. Tests + Production-Check

```bash
npm test
npm run check:production
npm run e2e
```

### 5. Push & PR

```bash
git push origin feature/my-feature
# → Erstelle PR auf GitHub
```

## 📝 Konfigurationsdateien

### `.prettierrc.json`

Prettier-Einstellungen (Code-Formatierung):

- Print Width: 120 Zeichen
- Tab Width: 2 Spaces
- Single Quotes
- Trailing Commas (ES5)

### `.eslintrc.json`

ESLint-Konfiguration (Linting):

- Basis-Regeln für ES2022 + React
- Warnung: `console.log` (außer warn/error)
- Fehler: Ungenutzte Variablen (außer `_`)

### `tsconfig.json`

TypeScript-Konfiguration:

- **strict: true** — Erzwingt Typ-Sicherheit
- Target: ES2022
- Module: ESNext
- Path-Alias: `@/*` → `./*`

### `.husky/pre-commit`

Automatischer Hook vor jedem Commit:

```bash
npx lint-staged
```

### `package.json` (lint-staged)

```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": ["prettier --write", "eslint --fix", "tsc --noEmit"],
    "*.{json,md,yaml,yml}": ["prettier --write"]
  }
}
```

## ❌ Fehlerbehebung

### Husky-Hooks funktionieren nicht

```bash
# Hooks neu initialisieren
npx husky install

# Hook-Datei prüfen
ls -la .husky/pre-commit
chmod +x .husky/pre-commit
```

### Prettier/ESLint Konflikt

```bash
# Prettier zuerst formatieren
npx prettier --write src/

# Dann ESLint
npx eslint --fix src/

# Dann Commit versuchen
```

### TypeScript Fehler in Pre-Commit

Falls `tsc --noEmit` in pre-commit fehlschlägt:

1. Fehler lesen
2. Typ-Annotationen hinzufügen
3. Erneut `git add` + `git commit`

### Secrets versehentlich committed

```bash
# Option 1: Datei aus History entfernen
git rm --cached .env.local
git commit -m "remove: leaked secrets"

# Option 2: Commit revert
git revert HEAD

# ⚠️ Danach: Secret in Deployment-Plattform wechseln
```

## 📚 Weitere Ressourcen

- **TypeScript**: [tsconfig.json](../tsconfig.json)
- **Prettier**: [.prettierrc.json](../.prettierrc.json)
- **ESLint**: [.eslintrc.json](../.eslintrc.json)
- **Husky**: [.husky/pre-commit](../.husky/pre-commit)
- **CLAUDE.md**: [CLAUDE.md](../CLAUDE.md)

## 🎓 Best Practices

✅ **DO:**

- Regelmäßig `npm test` laufen lassen
- Pre-commit Hooks beachten (fixes folgen dem ESLint output)
- Secrets niemals commiten
- TypeScript strict mode nutzen
- Tests zu neuen Features hinzufügen

❌ **DON'T:**

- `.env.local` commiten
- Husky-Hooks skipped (`--no-verify`)
- Service-Role-Keys ins Frontend
- Type-Errors ignorieren
- Ohne Tests committen (für wichtige Features)

---

**Letzte Aktualisierung**: 2026-07-20
