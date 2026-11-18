-- Runs once, the first time the Postgres volume is created. Schema itself is owned by Prisma migrations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
