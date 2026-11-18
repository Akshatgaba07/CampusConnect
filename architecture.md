# Architecture

```
Browser (React + Vite)
   │  HTTPS / WebSocket
   ▼
NGINX  ── load balances ──►  backend x2 (Node/Express, REST + Socket.IO)
   │                              │        │           │
   │ static files                 │        │           └──► Redis   (seat locks, rate limits, OTP cool-downs, job leader lock, socket adapter)
   ▼                              │        └──────────────► PostgreSQL (source of truth, Prisma)
frontend (nginx:alpine)           │
                                  ├─ HTTP + X-Internal-Key ─► qr-service (Spring Boot): verify QR, atomic check-in
                                  └─ outbox relay job ──────► Kafka topic "notifications" ─► notification-worker ─► Outlook SMTP
```

## Services
| Service | Tech | Job |
|---|---|---|
| frontend | React, Vite, Tailwind, Zustand, Recharts | Student and admin UIs. Holds no business truth. |
| backend | Node, Express, Prisma, JWT, bcrypt | Auth, events, booking engine, admin APIs, Socket.IO |
| qr-service | Spring Boot 3 (Java 17), JDBC | Validates QR tokens, marks tickets used atomically |
| notification-worker | Node, KafkaJS, Nodemailer | Sends confirmation / cancellation emails with QR images |
| postgres | PostgreSQL 16 | Primary data store |
| redis | Redis 7 | Fast locks and counters |
| kafka | Apache Kafka (KRaft) | Async notification pipeline |
| nginx | NGINX | Reverse proxy, load balancer, auth rate limit |

## Why each piece exists
- **Redis `SET NX`**: the first line of defence against two students taking one seat. It answers in microseconds and keeps contention away from Postgres.
- **Postgres**: the actual truth. Even if Redis were flushed, conditional `UPDATE ... WHERE status='AVAILABLE'`, a primary key on `seat_allocations(seat_id)` and a partial unique index still stop double booking.
- **Transactional outbox + Kafka**: booking confirmation writes an `outbox_events` row in the same DB transaction. A job relays it to Kafka. If Kafka or SMTP is down, bookings still succeed and emails go out later.
- **Socket.IO + Redis adapter**: seat changes appear live on every student's seat map, across both backend replicas.
- **Spring Boot qr-service**: separates the gate-scanning concern. Only the backend can call it (internal key; NetworkPolicy in k8s).

## Booking flow
1. `POST /bookings/hold` (idempotency key) validates the slot window, seat count, one-live-booking-per-slot.
2. `SET lock:seat:<id> <bookingId> NX EX` for each seat. Any failure releases the ones already taken (Lua compare-and-delete) and returns 409.
3. One DB transaction: create `PENDING` booking with `hold_expires_at`, flip each seat `AVAILABLE→HELD` conditionally, insert into `seat_allocations`.
4. Socket event `seats:update` (HELD).
5. `POST /bookings/:id/confirm` inside 5 minutes: claim the booking (`PENDING→CONFIRMED` only if the hold is still valid), `confirmed_count += n` only if it stays ≤ capacity, seats→`BOOKED`, tickets created, notification + outbox row written.
6. A job every 10 s expires stale holds (seats freed, locks deleted, sockets notified). Only one replica runs it (Redis leader lock).

## Authentication flow
`request-otp` → email OTP (6 digits, 10 min, hashed with a server pepper, 5 attempts) → `verify-otp` returns a one-time *registration token* → `set-password` creates the user (bcrypt) and a session. Access JWT lives 15 min; the refresh token is random, stored only as a SHA-256 hash, and rotated on every use (replay of an old one revokes all sessions).

## QR ticket
QR text = `CC1.<ticketId>.<token>` where `token = HMAC(ticketId, TICKET_HMAC_SECRET)`. The DB stores only `sha256(token)`. At the gate the Spring service re-hashes, compares in constant time, then checks booking/event state and time window, and finally runs `UPDATE tickets SET checked_in_at=now() WHERE id=? AND checked_in_at IS NULL`. Cancelling a booking deletes its tickets, so screenshots stop working immediately.

## Known limits (honest list)
- Single Kafka broker, single Postgres, single Redis: fine for a campus project, not for HA production.
- Payments are out of scope; bookings are free registrations.
- Refresh token lives in `localStorage` (simple, XSS-exposed). An httpOnly cookie is the stricter alternative.
- NGINX resolves `backend` once at start; restart it if you scale backend replicas.
