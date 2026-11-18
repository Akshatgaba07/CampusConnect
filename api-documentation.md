# REST API (base path `/api`, JSON)

Authenticated routes need `Authorization: Bearer <accessToken>`. Errors look like `{ "error": "message", "code": "OPTIONAL_CODE" }`.

## Auth (public)
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /auth/request-otp | `{email, purpose: REGISTER\|RESET}` | Only `@bennett.edu.in`. Always returns the same message (no account enumeration). 60 s cool-down, 5/hour |
| POST | /auth/verify-otp | `{email, otp, purpose}` | Returns `{registrationToken}` (15 min, single use) |
| POST | /auth/set-password | `{registrationToken, password, name?}` | Creates the account (or resets password). Returns `{accessToken, refreshToken, user}` |
| POST | /auth/login | `{email, password}` | 5 failures lock the email for 15 min |
| POST | /auth/refresh | `{refreshToken}` | Rotates the refresh token |
| POST | /auth/logout | `{refreshToken}` | 204 |
| GET | /auth/me | | Current user |

Password policy: 10-72 chars with lower, upper, digit and symbol.

## Student
| Method | Path | Description |
|---|---|---|
| GET | /events | Published events with slots and availability |
| GET | /events/:id | One event |
| GET | /slots/:slotId/seats | Seat map (`AVAILABLE/HELD/BOOKED`) |
| POST | /bookings/hold | `{slotId, seatIds[], idempotencyKey}` → 201 booking `PENDING` with `holdExpiresAt`. 409 `SEAT_TAKEN`, `ALREADY_BOOKED` |
| POST | /bookings/:id/confirm | Confirms and issues tickets. 409 `HOLD_EXPIRED`, `SLOT_FULL` |
| POST | /bookings/:id/cancel | Releases seats; confirmed bookings can't be cancelled within 1 h of start |
| GET | /bookings/mine | Bookings with seats and QR strings |

## Admin (role ADMIN)
| Method | Path | Description |
|---|---|---|
| GET | /admin/analytics | Totals, bookings per day, by category, fill rate |
| GET/POST | /admin/events | List all / create (DRAFT) |
| GET/PUT | /admin/events/:id | Read / update |
| POST | /admin/events/:id/publish · /complete · /cancel | Status changes. Cancel emails every attendee |
| POST | /admin/events/:id/slots | `{startsAt, endsAt, capacity (≤260), mode, maxSeatsPerBooking}`; generates seats |
| DELETE | /admin/slots/:slotId | Only if no active bookings |
| GET | /admin/events/:id/attendees | Confirmed seats with check-in state |
| POST | /admin/tickets/verify | `{qr}` read-only validation (proxied to Spring service) |
| POST | /admin/tickets/check-in | `{qr}` atomic admit |
| GET | /admin/users · PATCH /admin/users/:id/status | List / suspend or reactivate |
| GET | /admin/audit-logs | Latest 100 actions |

## Ticket check responses
`result` is one of `VALID`, `ADMITTED`, `ALREADY_USED`, `TOO_EARLY` (opens 2 h before slot), `SLOT_ENDED`, `INVALID`. Success payloads include `eventTitle, seat, slotStart, slotEnd, mode, venue, speaker, attendeeName, attendeeEmail`.

## Realtime
Socket.IO at `/socket.io`, auth via `{auth:{token}}`. Client emits `slot:join` with a slot id; server emits `seats:update {slotId, seatIds, status}`.
