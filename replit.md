# SmartCut — Barbershop Management & Customer Booking Platform

A full-stack web app connecting customers with barbershops: book appointments, track queues, earn loyalty points, and manage shop operations.

## Run & Operate
```bash
npm run dev          # Starts both server (port 3001) and client (port 5000) via concurrently
npm run dev:server   # Server only (nodemon)
npm run dev:client   # Client only (vite)
```
Required env vars: `DATABASE_URL`, `JWT_SECRET` (both set via Replit secrets)

## Stack
- **Frontend**: React 18, Vite 5, React Router 6, Axios, Recharts, React-Leaflet, Lucide React
- **Backend**: Node.js, Express 4, pg (PostgreSQL client), bcryptjs, jsonwebtoken, multer
- **Database**: PostgreSQL (Replit managed — `DATABASE_URL` secret)
- **Dev tooling**: concurrently, nodemon

## Where things live
- `client/src/pages/` — customer/, barbershop/, barber/ portals + Landing.jsx
- `client/src/context/AuthContext.jsx` — JWT auth state
- `client/src/utils/api.js` — Axios instance with JWT interceptor
- `client/vite.config.js` — proxies `/api` and `/uploads` → port 3001
- `server/routes/` — auth, barbershops, barbers, services, appointments, queue, ratings, notifications, customers, paymentMethods, bans, customerRatings, loyaltyPromos
- `server/middleware/auth.js` — JWT middleware (authenticateCustomer, authenticateBarbershop, authenticate)
- `server/db/index.js` — pg Pool connected to DATABASE_URL
- `server/db/schema.sql` — full DB schema (source of truth, 17 tables)
- `server/uploads/` — multer file storage (QR codes, logos, photos, payment proofs)

## Architecture decisions
- Monorepo: root `package.json` runs both via `concurrently`; each sub-package has its own `package.json` and `node_modules`
- Vite dev server proxies `/api` and `/uploads` to Express on port 3001, keeping a single origin for the browser
- JWT stored in `localStorage` as `smartcut_token` with a `type` field (`customer` | `barbershop` | `barber`)
- Per-shop loyalty tracked in `customer_shop_loyalty` junction table (not a global counter)
- File uploads stored on disk under `server/uploads/` and served via Express static middleware

## Product
- **Customer portal**: browse/search barbershops, book appointments, track live queue, view history, redeem loyalty promos
- **Barbershop owner portal**: analytics dashboard, manage barbers/services/queue, verify payments, view reviews
- **Barber portal**: manage own availability and services offered
- **Payment flow**: manual QR (GCash/Maya/bank) — customer uploads proof, owner verifies

## User preferences
_Populate as you build_

## Gotchas
- `pg` must be installed inside `server/node_modules` (not just root); run `cd server && npm install pg` if missing
- Schema applied via `server/db/schema.sql` — run manually against the Replit PostgreSQL DB on first setup
- `JWT_SECRET` must be set as a Replit secret/env var for auth to work
- React Router v6 future-flag warnings are cosmetic and do not affect functionality

## Pointers
- DB skill: `.local/skills/database/SKILL.md`
- Secrets skill: `.local/skills/environment-secrets/SKILL.md`
