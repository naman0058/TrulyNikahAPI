# TrulyNikah Node.js API

Standalone REST API for TrulyNikah, designed to run on a **separate KVM Hostinger server** while the Laravel website stays on the main hosting plan.

Both services share the **same MySQL database** used by the Laravel app.

---

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  Laravel Website        │         │  Node.js API (KVM)       │
│  trulynikah.com         │         │  api.trulynikah.com      │
│  Shared hosting plan    │         │  Hostinger KVM           │
└───────────┬─────────────┘         └────────────┬─────────────┘
            │                                    │
            └──────────────┬─────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   MySQL     │
                    │  (remote)   │
                    └─────────────┘
```

---

## Tech stack

- **Node.js 20+**
- **Express 5**
- **TypeScript**
- **Prisma** (reads existing Laravel tables — no migrations)
- **JWT** authentication (user + admin)
- **bcrypt** (compatible with Laravel password hashes)
- **Razorpay** + **mTalkz SMS**

---

## Quick start (local)

```bash
cd trulynikah-api
cp .env.example .env
# Edit .env with your DB credentials and secrets

npm install
npx prisma generate
npm run dev
```

API base URL: `http://localhost:4000/api/v1`  
Health check: `http://localhost:4000/health`

---

## Environment variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | MySQL connection string (same DB as Laravel) |
| `JWT_SECRET` | User token secret (min 32 chars) |
| `ADMIN_JWT_SECRET` | Admin token secret |
| `CORS_ORIGINS` | Comma-separated website URLs |
| `WEBSITE_URL` | Laravel site URL |
| `MTALKZ_*` | SMS OTP credentials |
| `RAZORPAY_*` | Payment credentials |

### Remote MySQL from KVM

On your **website hosting** (where Laravel runs):

1. Enable **Remote MySQL** in hPanel
2. Add the **KVM server public IP** to allowed hosts
3. Use that host as `DB_HOST` in the API `.env`

Example:

```env
DATABASE_URL="mysql://nikah_user:password@123.45.67.89:3306/nikahmubarak"
```

---

## API endpoints overview

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/v1/auth/register` | Register + send OTP |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/check-availability` | Check email/phone |
| GET | `/api/v1/locations/countries` | Countries list |
| GET | `/api/v1/plans` | Membership plans |
| GET | `/api/v1/faqs` | FAQs |
| GET | `/api/v1/blogs` | Blog list |

### Authenticated user

Send header: `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/otp/verify` | Verify OTP |
| POST | `/api/v1/auth/otp/resend` | Resend OTP |
| POST | `/api/v1/auth/onboarding/profile/step-1` | Profile wizard step 1 |
| POST | `/api/v1/auth/onboarding/profile/step-2` | Profile wizard step 2 |
| GET | `/api/v1/dashboard` | Dashboard feed |
| POST | `/api/v1/search` | Search profiles |
| POST | `/api/v1/interests/:userId` | Send interest |
| GET | `/api/v1/conversations` | Chat list |
| POST | `/api/v1/payments/razorpay/order` | Create payment order |

See `docs/API_PLANNING_DOCUMENT.md` in the parent project for full feature mapping.

---

## Registration example

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "behalf": "Self",
    "contact_number": "9876543210",
    "password": "password123"
  }'
```

Response:

```json
{
  "success": true,
  "message": "Registration successful. OTP sent to your phone.",
  "data": {
    "token": "eyJ...",
    "user": { "member_id": "NM-12345678", ... },
    "nextStep": "otp_verification"
  }
}
```

---

## KVM Hostinger deployment

### 1. Server setup

```bash
# On KVM (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```

### 2. Deploy code

```bash
git clone <your-repo> /var/www/trulynikah-api
cd /var/www/trulynikah-api/trulynikah-api
cp .env.example .env
nano .env   # production values

npm ci
npx prisma generate
npm run build
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 3. Nginx reverse proxy

Create `/etc/nginx/sites-available/trulynikah-api`:

```nginx
server {
    listen 80;
    server_name api.trulynikah.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/trulynikah-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.trulynikah.com
```

### 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Connect Laravel website to this API

In your Laravel `.env` (or frontend config), point API calls to:

```env
API_URL=https://api.trulynikah.com/api/v1
```

Update CORS on the API:

```env
CORS_ORIGINS=https://trulynikah.com,https://www.trulynikah.com
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma db pull` | Sync schema from live DB (optional) |

---

## Important notes

1. **Do not run `prisma migrate`** — Laravel owns the database schema.
2. Laravel bcrypt passwords (`$2y$`) work with this API login.
3. In development, OTP is logged to console if `MTALKZ_API_KEY` is empty.
4. User middleware mirrors Laravel: phone verified → profile complete → not blocked.
5. Admin uses a separate JWT secret from users.

---

## Project structure

```
trulynikah-api/
├── prisma/schema.prisma    # Maps to Laravel MySQL tables
├── src/
│   ├── config/             # Environment config
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Auth & validation
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── lib/                # Prisma, JWT, bcrypt
│   └── utils/              # Helpers
├── ecosystem.config.js     # PM2 config
├── .env.example
└── README.md
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| DB connection refused | Enable remote MySQL + whitelist KVM IP |
| CORS error | Add website URL to `CORS_ORIGINS` |
| Invalid login for existing users | Passwords are Laravel bcrypt — should work; check `BCRYPT_ROUNDS` |
| Prisma enum mismatch | Run `npx prisma db pull` to sync schema from live DB |

---

## Swagger / OpenAPI docs

After starting the server:

- **UI:** `http://localhost:4000/api-docs`
- **JSON:** `http://localhost:4000/api-docs.json`

---

## Profile photo uploads

```bash
curl -X POST http://localhost:4000/api/v1/me/photos \
  -H "Authorization: Bearer <token>" \
  -F "photo=@photo.jpg" \
  -F "field=profile_image"
```

Photos are stored under `uploads/profile_images/` and served at `/media/profile_images/...`.

Use `tn_api_media_url($path)` in Laravel Blade when API is enabled.

---

## Laravel website integration

In Laravel `.env`:

```env
TRULYNIKAH_API_ENABLED=true
TRULYNIKAH_API_URL=https://api.trulynikah.com/api/v1
TRULYNIKAH_API_MEDIA_URL=https://api.trulynikah.com/media
TRULYNIKAH_API_INTERNAL_SECRET=shared-secret-between-laravel-and-node
```

Set the same `INTERNAL_API_SECRET` / `TRULYNIKAH_API_INTERNAL_SECRET` on both servers.

The frontend JS client (`resources/js/api/client.js`) auto-initializes when enabled. Messaging, interests, payments, and uploads use dual-mode helpers that fall back to Laravel routes when API is disabled.

---

## Admin API endpoints (expanded)

| Group | Endpoints |
|-------|-----------|
| Plans | `GET/POST/PATCH /admin/plans`, `DELETE /admin/plans/:id`, assign/cancel subscriptions |
| FAQs | CRUD `/admin/cms/faqs` |
| Blogs | CRUD `/admin/cms/blogs` + categories |
| Stories | CRUD `/admin/cms/stories` |
| Policies | `GET/POST /admin/cms/policies` |
| Counters | `GET/PATCH /admin/cms/counters` |
| Messages | CRUD `/admin/messages`, chat audit `/admin/chats` |

---

For full business logic reference see: `../docs/API_PLANNING_DOCUMENT.md`
