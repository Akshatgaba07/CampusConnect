# Viva cheat-sheet

## One-minute pitch
CampusConnect lets Bennett students sign in with their college email (OTP-verified), pick a slot and an exact seat for an event, and get a QR ticket. Organisers publish events, watch analytics and scan tickets at the door. No two students can ever hold the same seat.

## Likely questions
**How do you stop two people booking the same seat?**
Three layers. (1) Redis `SET key NX EX`: only the first request gets the seat lock. (2) Postgres transaction with a conditional `UPDATE seats ... WHERE status='AVAILABLE'` and an insert into `seat_allocations` whose primary key is the seat. (3) A partial unique index so one student has one live booking per slot. Frontend state is only decoration.

**What if Redis loses its data?** Layers 2 and 3 still guarantee correctness; Redis only reduces contention.

**What is a hold?** A 5-minute `PENDING` booking so a student can confirm without losing seats. A background job expires old holds and frees seats; the UI shows a countdown.

**What is idempotency here?** The client sends an idempotency key with the hold request. A double-click or retry returns the same booking instead of creating another.

**Why Kafka for emails?** Booking must not wait for SMTP. We write an *outbox* row in the booking transaction, a relay publishes it to Kafka, and a worker sends the email, with retries and a dead-letter topic. If Kafka or Outlook is down, nothing is lost.

**Why a Spring Boot service?** It isolates ticket verification: its own deployable unit that validates the QR and performs the atomic check-in. Only the backend can reach it (shared internal key; NetworkPolicy on Kubernetes).

**How does the QR work, and can it be forged?** QR = `CC1.<ticketId>.<token>`; token is an HMAC of the ticket id with a server secret. We store only the SHA-256 of the token. Forging needs the secret; guessing a token is infeasible. Check-in is a single conditional UPDATE, so two scanners can't both admit one ticket. Cancelling deletes the ticket, so old screenshots fail.

**How is authentication secured?** Domain check on server (not just UI); OTP is random (CSPRNG), stored hashed, 10-minute expiry, 5 attempts, resend cooldown, hourly cap; passwords hashed with bcrypt (cost 12) and policy-checked; JWT access tokens (15 min) + rotating refresh tokens stored hashed; replay of a used refresh token revokes all sessions; login lockout after 5 failures; same-time response for unknown users.

**How is the admin decided?** Email in `ADMIN_EMAILS` gets role ADMIN when that person registers; all admin routes also check the role in the JWT. Admin actions are written to `audit_logs`.

**Why NGINX?** Reverse proxy and load balancer in front of two backend replicas (sticky `ip_hash` for Socket.IO), static hosting for the SPA, per-IP rate limit on `/api/auth`.

**How does realtime work with two backends?** Socket.IO with the Redis adapter: an event emitted by replica A reaches clients connected to replica B.

**What would you improve?** Payments, waitlist, Kafka/Postgres clustering, httpOnly cookie refresh tokens, E2E tests (Playwright), per-event seat layouts.

## Demo script (5 min)
Register with OTP → admin creates event+slot → publish → student sees it → two browsers race for one seat (live update, one gets "Someone just took that seat") → confirm → show email + QR → admin scans → Admitted → scan again → Already used → show dashboard and audit log.
