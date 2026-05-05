# Deploy — Frontend on Hostinger VPS

Hosts the static Vite build at `https://realsyncdynamicsai.de/`, served by
nginx, TLS via Let's Encrypt, auto-deploy via GitHub Actions over SSH.

Target VPS: `72.61.89.191`. Existing service (Kodee/OpenClaw Docker stack)
keeps running on the same machine; this just adds an nginx server block on
80/443 for the marketing + app domain.

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

| Name                    | Value                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| `VPS_SSH_HOST`          | `realsyncdynamicsai.de` (or `72.61.89.191`)                          |
| `VPS_SSH_USER`          | `deploy`                                                             |
| `VPS_SSH_KEY`           | Contents of `~/.ssh/realsync_github_actions` (the **private** key)   |
| `VPS_SSH_KNOWN_HOST`    | Single line from `ssh-keyscan -t ed25519 …`                          |
| `VPS_FRONTEND_PATH`     | `/var/www/realsyncdynamicsai.de/dist`                                |
| `VITE_SUPABASE_URL`     | `https://ebljyceifhnlzhjfyxup.supabase.co`                           |
| `VITE_SUPABASE_ANON_KEY`| Supabase Dashboard → API Settings → `anon public` (it's not secret)  |

---

## Verify

Push any commit that touches `src/**` (or trigger manually via
*Actions → Deploy Frontend → Run workflow*). Expected timeline:

```
Verify required secrets        2 s
Install dependencies         ~30 s
Build production bundle      ~10 s
Configure SSH                  1 s
Sync dist/ to VPS            ~5 s
Smoke-test the public URL     <1 s   → HTTP 200
```

Open https://realsyncdynamicsai.de/ — the Hard-Edge Industrial landing
should load. Then `/dashboard`, `/kodee`, `/billing/usage`, `/pricing`.

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
