# Database schema (PostgreSQL 16, managed by Prisma migrations)

Migrations live in `backend/prisma/migrations`:
1. `20261117000000_init` creates tables, enums, indexes and foreign keys.
2. `20261117000001_constraints` adds rules Prisma cannot express: CHECK constraints, the `seat_allocations` table and a partial unique index.

| Table | Purpose | Key columns / constraints |
|---|---|---|
| users | Accounts | `email` unique + CHECK ends with `@bennett.edu.in` and lowercase; `password_hash` (bcrypt); `role` STUDENT/ADMIN; `email_verified`; `status`; `last_login` |
| otp_challenges | Email OTPs | `otp_hash` (HMAC+pepper), `attempts/max_attempts`, `expires_at`, `consumed_at` |
| verified_registration_challenges | Proof that an OTP was verified | `token_hash` unique, `expires_at`, `used_at` (single use) |
| user_sessions | Refresh sessions | `refresh_token_hash` unique, `revoked_at`, `expires_at`, FK users (cascade) |
| events | Event master | status DRAFT/PUBLISHED/CANCELLED/COMPLETED; CHECK `registration_closes > registration_opens` |
| event_slots | Time slots | `capacity`, `confirmed_count` (CHECK 0 ≤ confirmed ≤ capacity), `mode`, `max_seats_per_booking`; CHECK `ends_at > starts_at` |
| seats | One row per physical seat per slot | unique `(slot_id,label)`, `status` AVAILABLE/HELD/BOOKED, `version` |
| bookings | A student's reservation | `status`, `quantity`, `hold_expires_at`, `idempotency_key` (unique per user); partial unique `(user_id,slot_id)` where PENDING/CONFIRMED |
| booking_seats | Seats in a booking | unique `(booking_id,seat_id)` |
| seat_allocations | **Double-booking backstop** | `seat_id` PRIMARY KEY: a seat can be in only one live booking |
| tickets | One QR per seat | `token_hash` unique, `booking_seat_id` unique, `checked_in_at`, `checked_in_by` |
| notifications | Email log | `type`, `payload`, `status` PENDING/SENT/FAILED |
| audit_logs | Admin actions | actor, action, entity, ip, metadata |
| outbox_events | Reliable Kafka publishing | `published_at` null = not yet sent |

## Relationships
users 1─* bookings *─1 event_slots *─1 events · event_slots 1─* seats · bookings 1─* booking_seats *─1 seats · booking_seats 1─1 tickets · users 1─* notifications · users 1─* audit_logs

## Indexes worth mentioning in a viva
- `bookings(status, hold_expires_at)` powers the hold-expiry job.
- `seats(slot_id, status)` powers seat-map and availability queries.
- `outbox_events(published_at, created_at)` powers the relay.
- `tickets.token_hash` unique prevents token collisions.

## Design decisions
- UUID primary keys (not guessable in URLs).
- Timestamps are stored in UTC; the UI formats them in Asia/Kolkata.
- Inventory (`confirmed_count`, seat status) is only ever changed server-side inside transactions.
