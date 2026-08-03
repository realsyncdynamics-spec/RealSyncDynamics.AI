# TLS/HTTPS Configuration

## Local Development

The stack runs with both **HTTP and HTTPS** enabled:

- **HTTP**: `http://builder.localhost`, `http://rsd.localhost`, `http://app.localhost`
- **HTTPS**: `https://builder.localhost`, `https://rsd.localhost`, `https://app.localhost` (self-signed certificate)

The self-signed certificate (`traefik/certs/server.crt`) is valid for all `*.localhost` domains and doesn't require manual browser trust configuration for local development.

### Browser Warning

Browsers will show a security warning for the self-signed certificate. This is expected and safe for local development — click "Advanced" → "Proceed" or the browser's equivalent to continue.

## Production Deployment

For production, Traefik is configured to use **ACME (Let's Encrypt)** for automatic certificate management:

1. **Update environment variables** in `.env.production`:
   ```bash
   ACME_EMAIL=your-email@example.com
   ```

2. **Switch ACME server** in `traefik/traefik.yml`:
   ```yaml
   # Change from staging to production:
   server: https://acme-v02.api.letsencrypt.org/directory
   ```

3. **Enable HTTP → HTTPS redirect** in `traefik/traefik.yml`:
   ```yaml
   entryPoints:
     web:
       address: ":80"
       http:
         redirections:
           entrypoint:
             to: websecure
             scheme: https
   ```

4. **Update frontend URLs** to use HTTPS:
   ```bash
   NEXT_PUBLIC_BUILDER_URL=https://builder.yourdomain.com
   NEXT_PUBLIC_GOVERNANCE_URL=https://rsd.yourdomain.com
   ```

## Configuration Files

### `traefik/traefik.yml`
- Defines `web` (port 80) and `websecure` (port 443) entrypoints
- Configures ACME resolver for Let's Encrypt
- Stores certificates in `acme.json`

### `traefik/dynamic.yml`
- TLS configuration: cipher suites, protocol versions (TLS 1.2+)
- Default certificate mount for local development
- HSTS headers for production

### `docker-compose.yml`
- Port `443:443` exposed for HTTPS
- Router labels include `entrypoints=web,websecure` and `tls=true`
- Mounts certificate files and ACME storage

## Certificate Details

**Local development certificate** (`traefik/certs/server.crt`):
- Self-signed
- Valid for `*.localhost` and `localhost`
- 365-day validity
- RSA 4096-bit key

**ACME staging server** (default for testing):
- Issues certificates that won't be in the certificate transparency logs
- Rate limits are much higher
- Use for testing deployment before enabling production

**ACME production server** (requires configuration):
- Issues publicly trusted certificates
- Subject to rate limits (50 certificates per domain per week)
- Only switch after testing with staging

## Security

- **Minimum TLS version**: 1.2
- **Cipher suites**:
  - TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
  - TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  - TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305
- **HSTS**: Configured for production (31536000s = 1 year, with preload)

## Testing TLS Locally

```bash
# Test HTTP
curl http://builder.localhost/health

# Test HTTPS (ignore self-signed warning)
curl --insecure https://builder.localhost/health
# or
curl -k https://builder.localhost/health

# Check certificate details
openssl s_client -connect localhost:443
```

## Troubleshooting

**Certificate permission denied error**:
- Ensure `traefik/certs/server.key` has permissions 600: `chmod 600 traefik/certs/server.key`

**ACME certificate acquisition fails**:
- Check `traefik/acme.json` file permissions: should be 600
- Verify email is correct in environment
- Review Traefik logs: `docker logs rsd_traefik`

**Browser won't connect to HTTPS**:
- Ensure port 443 is exposed: check `docker-compose.yml`
- Verify certificate is present: `ls -la traefik/certs/`
- Check Traefik logs for TLS errors
