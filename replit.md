# SmartCut — Barbershop Management & Customer Booking Platform

A full-stack web app connecting customers with barbershops: book appointments, track queues, earn per-shop loyalty points, manage shop operations, and administer the platform via a dedicated admin portal.

## Run & Operate
```bash
npm run dev          # Starts both server (port 3001) and client (port 5000) via concurrently
npm run dev:server   # Server only (nodemon)
npm run dev:client   # Client only (vite)
```
Required env vars: `DATABASE_URL`, `JWT_SECRET` (Replit secrets). Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD` (defaults: `admin@smartcut.com` / `Admin@SmartCut2024`).

## Stack
- **Frontend**: React 18, Vite 5, React Router 6, Axios, Recharts, React-Leaflet, Lucide React
- **Backend**: Node.js, Express 4, pg (PostgreSQL client), bcryptjs, jsonwebtoken, multer
- **Database**: PostgreSQL (Replit managed — `DATABASE_URL` secret)
- **Dev tooling**: concurrently, nodemon

## Where things live
- `client/src/pages/customer/` — Booking, History, Explore, Profile, BarbershopView, Dashboard, Appointments, QueueView
- `client/src/pages/barbershop/` — Dashboard, Appointments, Barbers, Services, Queue, Settings, Reviews, Promos
- `client/src/pages/barber/` — Dashboard, Profile (with account credentials tab), Reviews, Services (full CRUD)
- `client/src/pages/admin/` — Login, Dashboard, Barbershops, Reports, Settings (QR upload), Layout
- `client/src/context/AuthContext.jsx` — JWT auth state (types: customer | barbershop | barber | admin)
- `client/src/utils/api.js` — Axios instance with JWT interceptor
- `client/src/components/Map.jsx` — Leaflet map wrapper (markers, click-to-set, invalidateSize fix)
- `client/vite.config.js` — proxies `/api` and `/uploads` → port 3001
- `server/routes/` — auth, barbershops, barbers, services, appointments, queue, ratings, notifications, customers, paymentMethods, bans, customerRatings, loyaltyPromos, **admin**, **subscriptions**, **reports**, **barberRatings**
- `server/middleware/auth.js` — JWT middleware (authenticate, authenticateCustomer, authenticateBarbershop, authenticateBarber, authenticateAdmin, authenticateBarbershopOrBarber)
- `server/db/index.js` — pg Pool connected to DATABASE_URL
- `server/db/schema.sql` — full DB schema (source of truth, 20 tables)
- `server/uploads/` — multer file storage (QR codes, logos, photos, payment proofs, service images)

## Architecture decisions
- Monorepo: root `package.json` runs both via `concurrently`; each sub-package has its own `package.json`/`node_modules`
- Vite dev server proxies `/api` and `/uploads` to Express on port 3001 — single origin for browser
- JWT stored in `localStorage` as `smartcut_token` with `type` field (`customer|barbershop|barber|admin`)
- Per-shop loyalty tracked in `customer_shop_loyalty` junction table (not global); `loyalty_transactions` now has `barbershop_id`
- Admin account seeded on server startup from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars (idempotent)
- Barbers own and price their own services (`created_by_barber_id` on `services`); booking flow is barber-first, then shows only that barber's services
- Subscription system: barbershops/customers pay admin via QR → upload proof → admin approves via `/admin/subscriptions`; `subscription_status` column on both `barbershops` and `customers` tables
- File uploads stored on disk under `server/uploads/` and served via Express static middleware

## Product
- **Customer portal**: browse/search subscribed barbershops, 4-step barber-first booking (no downpayment), track live queue, detailed history with rating modal (shop + barber), per-shop loyalty points, subscription request, feedback/reports to admin
- **Barbershop owner portal**: analytics dashboard, manage barbers/services/queue, verify payments, view reviews, subscription request with QR payment, report submission
- **Barber portal**: manage own services (CRUD with price + image + category), profile with account credentials tab (email/password), availability toggle, rate customers after completed appointments
- **Admin portal**: `/admin-login` → dashboard stats, subscription approval (approve/reject with notification), barbershop management (toggle active), reports/feedback queue with responses, QR code upload for payment collection
- **Payment flow**: manual QR (GCash/Maya/bank) — customer uploads proof, owner or admin verifies
- **Maps**: Leaflet with OpenStreetMap, dark-themed tiles, invalidateSize fix for tab/modal rendering

## User preferences
- Admin credentials: `admin@smartcut.com` / `Admin@SmartCut2024` (seeded automatically)
- Subscription model: both barbershops and customers must subscribe (30-day approval cycle)
- T012 (Neon DB + Clerk auth) is pending — user needs to provide credentials

## Gotchas
- `pg` must be installed inside `server/node_modules` — run `cd server && npm install pg` if missing
- Schema applied via `server/db/schema.sql` — also includes migration-safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` guards
- `JWT_SECRET` must be set as a Replit secret for auth to work
- `input[type=number]` and all inputs use `font-size: 16px` to prevent iOS auto-zoom
- React Router v6 future-flag warnings are cosmetic and do not affect functionality
- `leaflet/dist/leaflet.css` imported globally in `client/src/main.jsx`

## Pointers
- DB skill: `.local/skills/database/SKILL.md`
- Secrets skill: `.local/skills/environment-secrets/SKILL.md`
