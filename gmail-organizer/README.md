# Gmail Auto Organizer

Automatischer E-Mail-Organizer für Gmail. Sortiert E-Mails automatisch nach Absender in Labels ein, erstellt fehlende Labels automatisch, und kann gelesen E-Mails ins Archiv verschieben.

## Funktionen

✅ Automatisches Labeling nach Absender  
✅ Erstellt Labels automatisch (z.B. "Google/Notifications" aus google@notifications.com)  
✅ Läuft alle 5 Minuten (konfigurierbar)  
✅ Verarbeitet alte und neue E-Mails  
✅ Optional: Archivierung bereits gelesener E-Mails  
✅ Doppelte Verarbeitung wird verhindert  
✅ Docker-kompatibel  
✅ Ausführliche Logdateien  
✅ Google OAuth 2.0 (sicher, keine Passwörter)  

## Voraussetzungen

- Docker & Docker Compose
- Google Cloud Projekt mit Gmail API aktiviert
- OAuth 2.0 Desktop-Anwendung erstellt
- `credentials.json` heruntergeladen

## Setup: Google Cloud Projekt (einmalig)

### 1. Google Cloud Projekt erstellen

1. Gehe zu https://console.cloud.google.com/
2. Erstelle neues Projekt: "Gmail Organizer"
3. Warte auf Aktivierung (1-2 Minuten)

### 2. Gmail API aktivieren

1. In der Console: Suche "Gmail API"
2. Klick auf "Enable"
3. Warte auf Aktivierung

### 3. OAuth 2.0 Desktop-App erstellen

1. Gehe zu "Credentials" (Berechtigungen) in der linken Sidebar
2. Klick auf "Create Credentials" (Berechtigungen erstellen)
3. Wähle "OAuth Client ID"
4. Wenn gefragt: "Configure OAuth consent screen" (Einwilligungsbildschirm konfigurieren):
   - User Type: **External**
   - App-Name: "Gmail Organizer"
   - User Support Email: Deine E-Mail
   - Developer Contact: Deine E-Mail
   - Speichern und fortfahren

5. Zurück zu "Create Credentials" → "OAuth Client ID"
6. Application Type: **Desktop app**
7. Klick auf "Create"
8. Klick auf Download-Icon (rechts) → speichert `credentials.json`

### 4. credentials.json Datei

Speichere die heruntergeladene `credentials.json` in:

```
gmail-organizer/credentials/credentials.json
```

## Installation & Starten

### 1. `.env` Datei erstellen

```bash
cp .env.example .env
```

Bearbeite `.env`:

```env
GOOGLE_CLIENT_ID=<aus credentials.json>
GOOGLE_CLIENT_SECRET=<aus credentials.json>
GMAIL_USER=deine-email@gmail.com
SCAN_INTERVAL_MINUTES=5
ARCHIVE_READ_EMAILS=false
DRY_RUN=false
LOG_LEVEL=INFO
```

### 2. Docker Container starten

```bash
docker compose up -d
```

Beim ersten Start:
- Der Container öffnet einen Browser zur OAuth-Authentifizierung
- Du musst deinen Gmail-Account auswählen und autorisieren
- Der Token wird in `credentials/token.json` gespeichert
- Der Agent startet automatisch

### 3. Logs anschauen

```bash
# Echtzeit-Logs
docker compose logs -f organizer

# Datei-Logs
tail -f logs/organizer.log

# Oder in Docker:
docker exec gmail-organizer tail -f /app/logs/organizer.log
```

## Struktur

```
gmail-organizer/
├── app/
│   ├── main.py              # Entry point
│   ├── organizer.py         # Hauptlogik
│   ├── gmail.py             # Gmail API wrapper
│   ├── labels.py            # Label-Verwaltung
│   ├── config.py            # Konfiguration
│   └── logger.py            # Logging
├── credentials/             # OAuth credentials (in .gitignore)
│   ├── credentials.json     # Google Cloud OAuth Secret
│   └── token.json           # Auto-generierter Access Token
├── data/                    # State persistence
│   └── organizer_state.json # Verarbeitete Message-IDs
├── logs/                    # Logdateien
│   └── organizer.log
├── Dockerfile               # Container-Definition
├── docker-compose.yml       # Docker Compose Config
├── requirements.txt         # Python Dependencies
└── README.md               # Diese Datei
```

## Konfiguration

### Umgebungsvariablen (.env)

| Variable | Typ | Beschreibung | Default |
|----------|-----|-------------|---------|
| `GOOGLE_CLIENT_ID` | str | Aus credentials.json | - |
| `GOOGLE_CLIENT_SECRET` | str | Aus credentials.json | - |
| `GMAIL_USER` | str | Gmail-Adresse (z.B. deine-email@gmail.com) | - |
| `SCAN_INTERVAL_MINUTES` | int | Wie oft der Agent läuft | 5 |
| `ARCHIVE_READ_EMAILS` | bool | Gelesen E-Mails archivieren? | false |
| `DRY_RUN` | bool | Nur simulieren, nicht ändern? | false |
| `LOG_LEVEL` | str | DEBUG / INFO / WARNING / ERROR | INFO |

## Beispiel-Labels

Der Agent erstellt automatisch Labels wie:

- **"Google/Notifications"** → von google@notifications.com
- **"Github"** → von noreply@github.com (local-part ignoriert)
- **"Stripe/Payments"** → von billing@stripe.com
- **"Newsletter"** → von newsletter@example.com

Labels werden nach dem Muster `"Domain/LocalPart"` erstellt.

## Troubleshooting

### "credentials.json not found"

```
Lösung: Datei muss in gmail-organizer/credentials/ liegen
```

### "Authentication failed"

```bash
# Token löschen und neu authentifizieren
rm credentials/token.json
docker compose restart organizer
```

### Keine E-Mails werden verarbeitet

```bash
# Debug-Modus aktivieren
# In .env: LOG_LEVEL=DEBUG
docker compose up -d
docker compose logs -f organizer

# Oder prüfen, ob ungelesene E-Mails vorhanden sind
```

### "Service Role" Error

```
Das ist normal und sicher. Der Agent nutzt nur User-Level Permissions.
```

## API-Limits (Google)

- **Kostenlos**: ∞ (unbegrenzt für persönliche Nutzung)
- **Rate Limit**: 250 Requests pro Minute
- Bei 5-Minuten-Intervall: ~1 Request pro Minute → Sicher

## Sicherheit

✅ **Keine Passwörter gespeichert** (nur OAuth Tokens)  
✅ **Service-Role Keys nicht in Client-Code**  
✅ **Lokale Speicherung**: credentials/ sollte in .gitignore sein  
✅ **Token wird nur in credentials/token.json gespeichert**  

## Befehle

```bash
# Start
docker compose up -d

# Logs
docker compose logs -f organizer

# Stop
docker compose down

# Rebuild (nach Code-Änderungen)
docker compose up -d --build

# In Container gehen
docker exec -it gmail-organizer bash

# Status
docker ps | grep gmail-organizer
```

## Entwicklung

### Lokal testen (ohne Docker)

```bash
# Python 3.11+ erforderlich
pip install -r requirements.txt
python -m app.main
```

### Dry-Run Mode (keine Änderungen)

```env
DRY_RUN=true
```

Startet den Agent, aber speichert keine Labels.

## Lizenz

Mit ❤️ gebaut für RealSyncDynamics.
