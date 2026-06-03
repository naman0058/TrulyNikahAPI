# Fix `/api/v1/state/76` still returning "Database operation failed"

The **SQL script fixes the database**. The **Node app must be redeployed** separately — editing MySQL does not update the running API process.

## On the KVM server (SSH)

```bash
cd /path/to/trulynikah-api   # your project folder on the server

# 1) Pull/copy latest code (must include src/services/location.service.ts)

# 2) Install & build
npm ci
npm run build
npx prisma generate

# 3) Restart PM2 (required)
pm2 restart trulynikah-api
pm2 logs trulynikah-api --lines 30
```

## Verify deploy worked

```bash
curl -s https://api.trulynikah.com/health
```

You must see:

```json
"build": "2026-06-03-location-fix",
"db": { "statesForCountry76": 28 }
```

- If **`build` is missing** → old code still running; repeat build + `pm2 restart`.
- If **`statesForCountry76": 0`** → SQL was run on a **different database** than `DATABASE_URL` in server `.env`. Run `location-setup.sql` on the DB in server `.env`, or fix `DATABASE_URL`.

Then:

```bash
curl -s https://api.trulynikah.com/api/v1/state/76
```

Should return a JSON **array** of states, not `{ "success": false, ... }`.

## Same database as phpMyAdmin?

On the server:

```bash
grep DATABASE_URL .env
```

That host/database must be where you imported `deploy/sql/location-setup.sql`.
