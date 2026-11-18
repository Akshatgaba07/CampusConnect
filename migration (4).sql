-- Hand-written integrity rules that Prisma's schema language cannot express.
ALTER TABLE "users" ADD CONSTRAINT "users_email_domain_chk" CHECK (lower("email") LIKE '%@bennett.edu.in' AND "email" = lower("email"));
ALTER TABLE "events" ADD CONSTRAINT "events_registration_window_chk" CHECK ("registration_closes" > "registration_opens");
ALTER TABLE "event_slots" ADD CONSTRAINT "event_slots_time_chk" CHECK ("ends_at" > "starts_at");
ALTER TABLE "event_slots" ADD CONSTRAINT "event_slots_capacity_chk" CHECK ("capacity" > 0 AND "confirmed_count" >= 0 AND "confirmed_count" <= "capacity");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quantity_chk" CHECK ("quantity" > 0);
-- A seat can belong to at most ONE live (pending/confirmed) booking: last line of defence against double booking.
CREATE TABLE "seat_allocations" (
  "seat_id" UUID PRIMARY KEY REFERENCES "seats"("id") ON DELETE CASCADE,
  "booking_id" UUID NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE
);
-- One live booking per user per slot.
CREATE UNIQUE INDEX "bookings_one_live_per_user_slot" ON "bookings"("user_id", "slot_id") WHERE "status" IN ('PENDING', 'CONFIRMED');
