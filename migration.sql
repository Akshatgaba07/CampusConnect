-- CampusConnect initial schema (matches prisma/schema.prisma)
CREATE TYPE "Role" AS ENUM ('STUDENT', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'RESET');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "SlotMode" AS ENUM ('OFFLINE', 'ONLINE', 'HYBRID');
CREATE TYPE "SeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'BOOKED');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "name" TEXT,
  "role" "Role" NOT NULL DEFAULT 'STUDENT',
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_login" TIMESTAMP(3),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "otp_challenges" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL DEFAULT 'REGISTER',
  "otp_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "ip" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "otp_challenges_email_created_at_idx" ON "otp_challenges"("email", "created_at");
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

CREATE TABLE "verified_registration_challenges" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" "OtpPurpose" NOT NULL DEFAULT 'REGISTER',
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verified_registration_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "verified_registration_challenges_token_hash_key" ON "verified_registration_challenges"("token_hash");
CREATE INDEX "verified_registration_challenges_email_idx" ON "verified_registration_challenges"("email");

CREATE TABLE "user_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "refresh_token_hash" TEXT NOT NULL,
  "user_agent" TEXT,
  "ip" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

CREATE TABLE "events" (
  "id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "venue" TEXT NOT NULL,
  "poster_url" TEXT,
  "speaker" TEXT,
  "organizer" TEXT NOT NULL,
  "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  "registration_opens" TIMESTAMP(3) NOT NULL,
  "registration_closes" TIMESTAMP(3) NOT NULL,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "events_status_registration_opens_idx" ON "events"("status", "registration_opens");
CREATE INDEX "events_category_idx" ON "events"("category");

CREATE TABLE "event_slots" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "confirmed_count" INTEGER NOT NULL DEFAULT 0,
  "mode" "SlotMode" NOT NULL DEFAULT 'OFFLINE',
  "max_seats_per_booking" INTEGER NOT NULL DEFAULT 2,
  CONSTRAINT "event_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_slots_event_id_starts_at_idx" ON "event_slots"("event_id", "starts_at");

CREATE TABLE "seats" (
  "id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "status" "SeatStatus" NOT NULL DEFAULT 'AVAILABLE',
  "version" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "seats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seats_slot_id_label_key" ON "seats"("slot_id", "label");
CREATE INDEX "seats_slot_id_status_idx" ON "seats"("slot_id", "status");

CREATE TABLE "bookings" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "slot_id" UUID NOT NULL,
  "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "quantity" INTEGER NOT NULL,
  "hold_expires_at" TIMESTAMP(3),
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bookings_user_id_idempotency_key_key" ON "bookings"("user_id", "idempotency_key");
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");
CREATE INDEX "bookings_slot_id_status_idx" ON "bookings"("slot_id", "status");
CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings"("status", "hold_expires_at");

CREATE TABLE "booking_seats" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "seat_id" UUID NOT NULL,
  CONSTRAINT "booking_seats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_seats_booking_id_seat_id_key" ON "booking_seats"("booking_id", "seat_id");
CREATE INDEX "booking_seats_seat_id_idx" ON "booking_seats"("seat_id");

CREATE TABLE "tickets" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "booking_seat_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checked_in_at" TIMESTAMP(3),
  "checked_in_by" TEXT,
  CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tickets_booking_seat_id_key" ON "tickets"("booking_seat_id");
CREATE UNIQUE INDEX "tickets_token_hash_key" ON "tickets"("token_hash");
CREATE INDEX "tickets_booking_id_idx" ON "tickets"("booking_id");

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'EMAIL',
  "payload" JSONB NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMP(3),
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_slots" ADD CONSTRAINT "event_slots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seats" ADD CONSTRAINT "seats_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "event_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "event_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_seats" ADD CONSTRAINT "booking_seats_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_booking_seat_id_fkey" FOREIGN KEY ("booking_seat_id") REFERENCES "booking_seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
