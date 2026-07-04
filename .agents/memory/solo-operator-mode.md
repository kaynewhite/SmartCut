---
name: Solo Operator Mode (barbershop = barber)
description: How a one-person barbershop merges shop + barber into a single account without duplicate logins/UI.
---

Barbershops can toggle `is_solo` (column on `barbershops`) to mark themselves as one-person operations. When enabled, the shop owner's existing barbershop login gains full access to the barber-only pages/routes — no second "barber" account is created.

**Why:** the product requirement was zero duplicate logins/UI. Reusing the existing barber pages/routes verbatim (instead of building shop-specific equivalents) meant zero new UI to maintain, and kept the barber feature set (profile, services CRUD, reviews) as the single source of truth.

**How it works:**
- `server/utils/soloBarber.js` → `resolveActingBarberId(req)`: if `req.user.type === 'barber'`, returns their id; if `barbershop` with `is_solo`, resolves the shop's single internal `barbers` row id (throws otherwise). All barber-only routes that should also serve solo shops call this instead of trusting `req.user.id` directly, and are guarded with `authenticateBarbershopOrBarber` instead of `authenticateBarber`.
- Enabling solo mode (`PUT /barbershops/me/solo-mode`) auto-creates the single internal barber row if none exists, and blocks enabling if the shop already has >1 barbers. Disabling just flips the flag.
- Adding/removing barbers is blocked server-side while `is_solo` is true (belt-and-suspenders alongside hiding the UI).
- Frontend: `ProtectedBarber` route guard, `Layout.jsx` nav links, and `barber/Profile.jsx`'s account/password tab all branch on `user.type === 'barbershop' && user.is_solo` to grant access while hiding shop-owner-irrelevant bits (e.g. barber login credentials tab, since the shop already manages its own password in Settings → Security).
- `barbershop/Barbers.jsx` stays reachable by direct URL but shows an explanatory banner instead of the barber list/add button when solo.

**How to apply:** when adding a new barber-only feature/route, check whether solo shops should access it — if so, use `authenticateBarbershopOrBarber` + `resolveActingBarberId`, not `authenticateBarber` + `req.user.id`.
