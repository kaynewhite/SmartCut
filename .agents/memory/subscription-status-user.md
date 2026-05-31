---
name: Subscription status in user object
description: subscription_status is available on the localStorage user object for customers and barbershops
---

Customer login uses `SELECT * FROM customers WHERE email=$1` so `subscription_status` is included in the returned user object and stored in `localStorage` as `smartcut_user`. Barbershop register also returns `subscription_status`.

**Why:** The auth context reads from localStorage — if login queries omit a column, it won't be in `user`.

**How to apply:** `user?.subscription_status` can be read from `useAuth()` for customers. For real-time subscription state (e.g. is the subscription currently active, expiry date), always call `GET /subscriptions/status` separately since the localStorage value may be stale.
