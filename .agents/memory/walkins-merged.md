---
name: Walk-ins merged with appointments response
description: /appointments/shop returns two arrays; walk_ins are separate from appointments
---

`GET /appointments/shop` returns `{ appointments: [...], walk_ins: [...] }` — two separate arrays. Walk-ins have `appointment_type: 'walk_in'`, a `customer_name` string (not a customer FK), and no `payment_status` or `total_amount`.

**Why:** Walk-ins are stored in the `walk_ins` table (not `appointments`), keyed by `queue_number`. They can't be merged into a single DB query cleanly due to schema differences.

**How to apply:** Any barbershop/barber UI consuming this endpoint must destructure both arrays from `res.data` and render them separately or concatenate with a type discriminator before display.
