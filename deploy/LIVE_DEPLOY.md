# Live deployment — fix Swagger & API URL

## What you have today (two different APIs)

| URL | What responds |
|-----|----------------|
| `http://api.trulynikah.com/` | **Old/other API** — `"Welcome to the Nikah API"` |
| `http://api.trulynikah.com:4000/` | **Node TrulyNikah API** (this project) |

Port **4000** must not be used in the browser on production. Browsers force **HTTPS** on `*.trulynikah.com` (HSTS), so assets load as `https://api.trulynikah.com:4000/...` but Node only speaks **HTTP** → `ERR_SSL_PROTOCOL_ERROR`.

## Correct production URL

Use **no port**, with **HTTPS**:

- API: `https://api.trulynikah.com/api/v1`
- Swagger: `https://api.trulynikah.com/api-docs`
- Health: `https://api.trulynikah.com/health`

## Steps on KVM server

### 1. Server `.env`

```env
NODE_ENV=production
PORT=4000
APP_URL=https://api.trulynikah.com
SWAGGER_ENABLED=true
```

Redeploy/restart Node after changing `.env`.

### 2. Nginx — proxy port 443 → Node on 4000

Point `api.trulynikah.com` to **this** Node app (replace whatever serves the old welcome message).

Use `deploy/nginx.conf.example`, then:

```bash
sudo certbot --nginx -d api.trulynikah.com
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Firewall — block public port 4000

Only nginx on the same machine should reach `127.0.0.1:4000`.

```bash
# Example (ufw): allow 80/443, do NOT expose 4000 publicly
sudo ufw allow 80
sudo ufw allow 443
```

### 4. Verify

```bash
curl -s https://api.trulynikah.com/health
curl -s https://api.trulynikah.com/api/v1/
curl -s https://api.trulynikah.com/api/v1/state/76
curl -s https://api.trulynikah.com/api/v1/city/1
```

After code changes (e.g. state/city location fix):

```bash
cd trulynikah-api
npm run build
pm2 restart trulynikah-api
```

If `state` / `city` still fail, ensure `countries`, `states`, and `cities` tables exist and India has states. Either Laravel:

```bash
php artisan migrate
php artisan db:seed --class=StateSeeder
```

Or run SQL directly (phpMyAdmin / `mysql` CLI) — no PHP required:

```bash
mysql -u USER -p DATABASE_NAME < deploy/sql/location-setup.sql
```

File: `deploy/sql/location-setup.sql` (creates tables if missing, inserts India + 28 states). Check India's id: `SELECT id FROM countries WHERE name = 'India';` then call `GET /api/v1/state/{that_id}` (often `76` if countries were seeded in default order).

Browser: open `https://api.trulynikah.com/api-docs` (not `:4000`).

## Why localhost works

`http://localhost:4000` is a [trustworthy origin](https://www.w3.org/TR/powerful-features/#potentially-trustworthy-origin) and has no HSTS upgrade — Swagger loads normally.
