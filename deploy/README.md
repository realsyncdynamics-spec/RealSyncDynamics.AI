# Deploy — Frontend on Hostinger VPS

Hosts the Vite React SPA at `https://realsyncdynamicsai.de/`, served by
nginx reverse proxy, TLS via Let's Encrypt, auto-deployed via GitHub Actions.

**Target VPS:** `72.61.89.191`  
**Deployment Method:** Git push → GitHub Actions → SSH rsync → Docker Compose on VPS  
**Existing Services:** Kodee/OpenClaw Python stack on port 8080 (untouched)

## Architektur

```
GitHub (main push)
    ↓
GitHub Actions
    ├─ npm ci
    ├─ npm run lint
    ├─ npm run build
    └─ rsync dist/ + all source to VPS
        ↓
    VPS (realsyncdynamicsai.de)
        ├─ docker compose --env-file .env up -d --build
        └─ realsync-frontend:latest → http://127.0.0.1:8090
            ↓
        nginx (public 80/443)
            └─ https://realsyncdynamicsai.de
```

---

## One-time VPS setup (~15 min)

SSH in as root or a user with sudo. Replace `<deploy>` with whatever username
you pick for the unprivileged deploy account.

### 1. Install nginx + certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx rsync
sudo systemctl enable --now nginx
```

### 2. Create deploy user with restricted access

```bash
sudo useradd -m -s /bin/bash deploy
sudo mkdir -p /var/www/realsyncdynamicsai.de/dist
sudo chown -R deploy:deploy /var/www/realsyncdynamicsai.de

# certbot's webroot challenge directory
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
```

### 3. Generate SSH keypair for CI

On **your laptop** (NOT on the VPS):

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/realsync_github_actions -N ""
cat ~/.ssh/realsync_github_actions.pub      # copy this output
```

Then on the VPS, paste the public key into the deploy user's
`authorized_keys`:

```bash
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy chmod 700 /home/deploy/.ssh
echo 'ssh-ed25519 AAAA…github-actions' | sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys
sudo -u deploy chmod 600 /home/deploy/.ssh/authorized_keys
```

Restrict the key in `authorized_keys` (recommended — prevents shell access,
only allows rsync into the dist directory):

```
command="rrsync -wo /var/www/realsyncdynamicsai.de/dist",no-pty,no-agent-forwarding,no-port-forwarding,no-X11-forwarding ssh-ed25519 AAAA…github-actions
```

### 4. Drop the nginx config

```bash
sudo cp deploy/nginx/realsyncdynamicsai.de.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/realsyncdynamicsai.de.conf \
            /etc/nginx/sites-enabled/realsyncdynamicsai.de.conf
sudo nginx -t                                # syntax check
sudo systemctl reload nginx
```

### 5. Issue the TLS certificate

```bash
sudo certbot --nginx \
  -d realsyncdynamicsai.de \
  -d www.realsyncdynamicsai.de \
  --email YOU@EXAMPLE.COM --agree-tos --redirect --non-interactive
```

certbot rewrites the nginx config to add the `ssl_certificate` lines and
sets up auto-renewal via systemd timer (`systemctl list-timers | grep certbot`).

### 6. Capture the host key for CI

On **your laptop**:

```bash
ssh-keyscan -t ed25519 realsyncdynamicsai.de
```

Save the single line that comes back — you'll paste it into a GitHub Secret.

---

## DNS

In your registrar (Hostinger DNS panel for `realsyncdynamicsai.de`):

| Type  | Host | Value          | TTL  |
| ----- | ---- | -------------- | ---- |
| A     | `@`  | `72.61.89.191` | 3600 |
| A     | `www`| `72.61.89.191` | 3600 |

If `hermes.dns-parking.com` / `artemis.dns-parking.com` are still set as the
nameservers, the A-record edit happens in the registrar's "DNS / Nameservers"
panel, not on a separate Cloudflare. Hostinger's DNS-parking handles records
directly.

Verify after a few minutes:

```bash
dig +short realsyncdynamicsai.de A
dig +short www.realsyncdynamicsai.de A
# both should return 72.61.89.191
```

---

## GitHub repo secrets

`Settings → Secrets and variables → Actions → New repository secret`:

| Name                    | Value / Source                                                       |
| ----------------------- | -------------------------------------------------------------------- |
| **SSH/Deployment**      |                                                                      |
| `VPS_SSH_HOST`          | `realsyncdynamicsai.de` (or `72.61.89.191`)                          |
| `VPS_SSH_USER`          | `deploy` (or username with sudo)                                     |
| `VPS_SSH_KEY`           | Private key from `~/.ssh/realsync_github_actions` (output of `cat ~/.ssh/realsync_github_actions`) |
| `VPS_SSH_KNOWN_HOST`    | Host key from `ssh-keyscan -t ed25519 realsyncdynamicsai.de`         |
| **Frontend Build**      |                                                                      |
| `VITE_SUPABASE_URL`     | `https://ebljyceifhnlzhjfyxup.supabase.co` (Supabase Dashboard)     |
| `VITE_SUPABASE_ANON_KEY`| Supabase Dashboard → API Settings → `anon public` key               |
| `VITE_SENTRY_DSN`       | (Optional) Sentry project DSN, leave blank to disable               |

---

## Deployment Workflow — GitHub Actions

**File:** `.github/workflows/deploy-frontend-vps.yml`

**Trigger:** 
- Auto: Any push to `main` that touches `src/`, `package.json`, Dockerfile, etc.
- Manual: GitHub → Actions → Deploy Frontend to Hostinger VPS → Run workflow

**Expected Timeline:**
```
Setup Node.js                  ~15 s
Install dependencies           ~30 s
Run linting (non-blocking)      ~5 s
Run type check (non-blocking)   ~3 s
Build production bundle        ~15 s
Configure SSH                   2 s
Rsync source to VPS           ~10 s
Docker Compose build+deploy   ~30 s
Health check polling           ~10 s
Verify public URL              ~5 s
─────────────────────────────────
Total                       ~125 s (~2 min)
```

### Manual Deployment Verification

After workflow completes, verify:

```bash
# From your laptop
curl -I https://realsyncdynamicsai.de/
curl -I https://realsyncdynamicsai.de/healthz

# Check specific pages
curl -s https://realsyncdynamicsai.de/pricing | grep -q "Pricing" && echo "✓"
```

### On VPS - Manual Health Check

SSH into VPS and run:
```bash
docker ps -f name=realsync-frontend --format '{{.Names}}\t{{.Status}}'
docker compose -f deploy/frontend-vps-deploy-v2/docker-compose.yml logs frontend --tail=20
```

### Rollback (on VPS)

If deployment fails, rollback to previous version:
```bash
cd deploy/frontend-vps-deploy-v2
docker compose down
docker image tag realsync-frontend:previous realsync-frontend:latest
docker compose --env-file .env up -d
```

---

## Troubleshooting

| Symptom                                     | Fix                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `permission denied (publickey)` in CI       | private key wrong, missing trailing newline, or `authorized_keys` not chmod 600 |
| `Host key verification failed` in CI        | `VPS_SSH_KNOWN_HOST` empty / wrong; re-run `ssh-keyscan`            |
| nginx 403 / 404 after deploy                | `dist/index.html` not present; check rsync log; verify `VPS_FRONTEND_PATH` |
| Cert renewal warning                        | `sudo certbot renew --dry-run` — fix the nginx config first         |
| Site loads but Supabase 401                 | `VITE_SUPABASE_ANON_KEY` wrong / not baked into the build           |
| CSP errors in browser console               | extend `Content-Security-Policy` in the nginx config to allow the host |
