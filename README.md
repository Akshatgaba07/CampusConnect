# CampusConnect

Event booking for Bennett University: OTP-verified `@bennett.edu.in` sign-in, live seat selection with race-safe booking, QR tickets verified at the gate, and an organiser console.

**Stack:** React + Vite + Tailwind · Node/Express + Prisma + PostgreSQL · Redis · Socket.IO · Apache Kafka · Spring Boot (QR service) · NGINX · Docker Compose · Kubernetes · GitHub Actions.

```
CampusConnect/
├── frontend/              React app (student + admin)
├── backend/               Express API (src/config, controllers, middleware, routes, services, repositories, utils, jobs), prisma/, tests/
├── qr-service/            Spring Boot ticket verification + check-in
├── notification-worker/   Kafka consumer that sends emails
├── nginx/                 Reverse proxy / load balancer
├── docker/                Frontend image, Postgres init script
├── k8s/                   Kubernetes manifests
├── docs/                  architecture, database-schema, api-documentation, setup-guide, viva-explanation
└── docker-compose.yml
```

## Quick start
```bash
cp .env.example .env     # fill the secrets (see docs/setup-guide.md)
docker compose up --build
# open http://localhost
```
Read **docs/setup-guide.md** first (Outlook SMTP notes included) and **docs/viva-explanation.md** before your presentation.

## Security notes
- `.env` is git-ignored; commit only `.env.example`.
- User passwords exist only as bcrypt hashes in the database.
- Admin = emails listed in `ADMIN_EMAILS`.
