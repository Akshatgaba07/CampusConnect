# Setup guide

## 0. You need
Docker Desktop, Java 17+ (only if running qr-service outside Docker), Node 20+ (only for local dev).

## 1. Secrets
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # run 4 times
```
Paste one value each into `JWT_ACCESS_SECRET`, `TICKET_HMAC_SECRET`, `OTP_PEPPER`, `INTERNAL_API_KEY`. Set a database password in `POSTGRES_PASSWORD` **and** inside `DATABASE_URL`.

**About "passwords in env":** user passwords are never stored in `.env` or anywhere in plain text. Each person types a password once when they register; the server stores only a bcrypt hash in PostgreSQL (`users.password_hash`). `.env` holds only the *server's* secrets (DB password, signing keys, the mailbox app password) and is git-ignored. Your admin password is chosen by you at first sign-up, not kept in a file.

## 2. Outlook SMTP for OTP emails
The backend and the worker send mail with Nodemailer through `smtp-mail.outlook.com:587` (STARTTLS).

1. Use a **dedicated sender mailbox** at outlook.com (create e.g. `campusconnect.bu@outlook.com`).
2. Turn on two-step verification, then create an **app password** (Microsoft account → Security → Advanced security options → App passwords).
3. Put the address in `SMTP_USER` / `SMTP_FROM`, the app password in `SMTP_PASS`.

Heads-up: as far as I know, Microsoft 365 work/school mailboxes (like a `@bennett.edu.in` one) usually have basic SMTP login disabled by the tenant admin, so a personal outlook.com sender is the reliable route. Mail is then delivered *to* Bennett inboxes normally. First-time messages may land in Junk, so check there while testing. Free outlook.com accounts also have daily send limits (a few hundred), which is fine for a college project.

If OTP emails fail, backend logs show `[otp-mail] ...` with Microsoft's reason.

## 3. Run everything
```bash
docker compose up --build
```
Open http://localhost. The backend runs migrations automatically on start.

Sign up with `s24cseu1608@bennett.edu.in` (listed in `ADMIN_EMAILS`) → you land in the organiser console. Everyone else is a student.

## 4. First demo
1. Admin: Events → New event → add a slot (e.g. 40 seats) → Publish.
2. Student (another browser/incognito): book seats → confirm → ticket + email.
3. Admin: Check-in → paste or scan the QR → Admit. Scan again → "Already used".
4. Open the same slot in two browsers and watch seats turn amber/grey live.

## 5. Local development without Docker for the apps
```bash
docker compose up postgres redis kafka -d        # infra only (add `ports:` mappings for 5432/6379/9092 in an override file)
cd backend && npm i && npx prisma generate && npx prisma migrate deploy && npm run dev
cd frontend && npm i && npm run dev              # http://localhost:5173 proxies /api to :4000
cd qr-service && mvn spring-boot:run
cd notification-worker && npm i && npm start
```
Backend env vars come from your shell/.env (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `TICKET_HMAC_SECRET`, `OTP_PEPPER`, `INTERNAL_API_KEY`, SMTP_*).

## 6. Tests
`cd backend && npm test` · `cd notification-worker && npm test` · `cd qr-service && mvn test`

## 7. Kubernetes
Create the secret from your env values (see the template in `k8s/00-namespace-config.yaml`), replace `OWNER` in image names, then `kubectl apply -f k8s/`. Needs the ingress-nginx controller.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "We could not send the email" | Check SMTP_USER/SMTP_PASS (app password, not your login password); look at `docker compose logs backend` |
| Backend restarts at boot | A required secret in `.env` is empty |
| Emails never arrive but booking works | `docker compose logs notification-worker`; failed ones park in topic `notifications.dlq` and `notifications.status='FAILED'` |
| Check-in says service unreachable | `docker compose logs qr-service`; `INTERNAL_API_KEY` must match |
