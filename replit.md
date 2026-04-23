# SmartCut — Barbershop Operations & Customer Engagement System

## Overview
A full-stack web application for barbershop management and customer booking. Features separate portals for barbershop owners, barbers, and customers, with real-time queue management, appointment booking, QR-code payments, and per-shop loyalty rewards.

## Recent Changes (Apr 2026)
- **Per-shop loyalty**: Points are tracked per (customer, barbershop) in `customer_shop_loyalty`. Earned on completed appointments and ratings, redeemed only via the Promos tab on each shop's BarbershopView. Server endpoints: `GET /loyalty-promos/balance/:shopId`, redeem deducts per-shop balance.
- **Role split**: Barbers (separate `/barber/*` pages) add only the NAMES of services they offer (price NULL). Owner page renamed "Service Pricing" — owner cannot add services, only sets price/duration/category and toggles active. Unpriced services are hidden from public listings until priced.
- **Map**: Standard OSM tiles, click-only pin selection (no drag) on owner Settings.
- **DB**: Added `services.created_by_barber_id`, `services.price` nullable, `loyalty_transactions.barbershop_id`.

## Architecture
- **Frontend**: React 18 + Vite (port 5000, host 0.0.0.0)
- **Backend**: Express.js (port 3001, host localhost)
- **Database**: MongoDB (accessed via `MONGODB_URI` or `DATABASE_URL`)
- **Workflow**: `npm run dev` at root runs both via `concurrently`

## Project Structure
```
smartcut/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx     # Sidebar navigation with auth context
│   │   ├── context/
│   │   │   └── AuthContext.jsx # JWT auth state, customer/barbershop types
│   │   ├── pages/
│   │   │   ├── Landing.jsx    # Homepage with hero + stats
│   │   │   ├── customer/      # Customer portal pages
│   │   │   │   ├── Login.jsx, Register.jsx
│   │   │   │   ├── Dashboard.jsx     # Upcoming appts + loyalty + recs
│   │   │   │   ├── Explore.jsx       # Search/filter barbershops
│   │   │   │   ├── BarbershopView.jsx# Shop detail + service list
│   │   │   │   ├── Booking.jsx       # Time-slot + QR payment flow
│   │   │   │   ├── Appointments.jsx  # Payment proof upload + rating
│   │   │   │   ├── History.jsx       # Haircut history with filters
│   │   │   │   ├── Profile.jsx       # Customer profile + loyalty pts
│   │   │   │   └── QueueView.jsx     # Live queue status viewer
│   │   │   └── barbershop/    # Barbershop owner pages
│   │   │       ├── Login.jsx, Register.jsx
│   │   │       ├── Dashboard.jsx  # Analytics with Recharts
│   │   │       ├── Appointments.jsx # Payment verification
│   │   │       ├── Barbers.jsx    # Barber CRUD + availability
│   │   │       ├── Services.jsx   # Service CRUD + image upload
│   │   │       ├── Queue.jsx      # Walk-in queue management
│   │   │       ├── Settings.jsx   # QR code + logo upload
│   │   │       └── Reviews.jsx    # Rating overview + review list
│   │   ├── utils/
│   │   │   └── api.js         # Axios instance with JWT interceptor
│   │   ├── App.jsx            # React Router routes
│   │   └── index.css          # CSS variables + global styles
│   ├── vite.config.js         # Proxy /api and /uploads → port 3001
│   └── package.json
├── server/                    # Express backend
│   ├── routes/
│   │   ├── auth.js            # Register/login (customer + barbershop)
│   │   ├── barbershops.js     # Profile, QR code, logo uploads
│   │   ├── barbers.js         # CRUD, availability, schedules
│   │   ├── services.js        # CRUD + service image uploads
│   │   ├── appointments.js    # Book, list, payment proof, verify, rate
│   │   ├── queue.js           # Walk-in queue CRUD
│   │   ├── ratings.js         # Create + fetch ratings
│   │   ├── notifications.js   # List + mark-read
│   │   ├── recommendations.js # Smart scoring engine
│   │   └── customers.js       # Profile, loyalty, history
│   ├── middleware/
│   │   └── auth.js            # JWT middleware: authenticate, authenticateCustomer, authenticateBarbershop
│   ├── db.js                  # pg Pool connected to DATABASE_URL
│   ├── schema.sql             # Full DB schema (11 tables)
│   ├── uploads/               # Multer file storage (QR, logos, photos)
│   └── index.js               # Express app entry point
└── package.json               # Root: concurrently dev:server + dev:client
```

## Database Schema (11 tables)
- `customers` — id, name, email, password_hash, phone, loyalty_points, city
- `barbershops` — id, name, email, password_hash, phone, address, city, description, logo_url, qr_code_url, opening_time, closing_time, is_verified
- `barbers` — id, barbershop_id, name, bio, photo_url, is_available
- `barber_specialties` — barber_id, specialty
- `barber_schedules` — barber_id, day_of_week, start_time, end_time
- `services` — id, barbershop_id, name, description, price, duration_minutes, image_url, is_active
- `appointments` — id, customer_id, barbershop_id, barber_id, service_id, appointment_date, appointment_time, status, type (appointment/home_service), payment_status, payment_proof_url, total_amount, queue_number, notes
- `walk_ins` — id, barbershop_id, barber_id, service_id, customer_name, status, queue_number
- `ratings` — id, appointment_id, customer_id, barbershop_id, barber_id, barbershop_rating, barber_rating, comment
- `notifications` — id, customer_id, barbershop_id, title, message, type, is_read
- `loyalty_transactions` — id, customer_id, points, type, description

## Authentication
- JWT with a `type` field: `'customer'` or `'barbershop'`
- Separate middleware: `authenticateCustomer`, `authenticateBarbershop`, `authenticate` (either)
- Token stored in `localStorage` as `smartcut_token`
- Separate login flows at `/customer/login` and `/barbershop/login`

## Payment Flow (Manual QR)
1. Barbershop uploads their GCash/Maya/bank QR image via Settings → stored in `server/uploads/`
2. Customer books an appointment → sees QR code during payment step → scans and pays externally
3. Customer uploads a payment proof screenshot via Appointments page
4. Barbershop owner reviews proof and clicks "Verify Payment" to confirm

## Key Features
- Smart barbershop recommendations (scoring: ratings 20pts, city match 30pts, price 15pts, review count bonus)
- Real-time queue management (walk-ins + appointments, with status: waiting → in_progress → done)
- Loyalty points system (earned on completed appointments, displayed in customer profile)
- Home service appointment type
- Rating/review system (barbershop + individual barber ratings)
- File uploads: QR codes, logos, barber photos, service images, payment proofs

## Design
- Dark navy background: `#0a0e1a`
- Gold accent: `#d4af37`
- Typography: Playfair Display (headings), Inter (body)
- CSS Modules for component-scoped styles
- Responsive layout with sidebar navigation

## Running the Project
```bash
npm run dev          # Starts both server (3001) and client (5000) via concurrently
npm run dev:server   # Server only
npm run dev:client   # Client only
```
