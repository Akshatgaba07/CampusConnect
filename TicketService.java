package in.edu.bennett.campusconnect.qr;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TicketService {
    private static final Duration EARLY_ENTRY = Duration.ofHours(2);

    private static final String SQL = """
        SELECT t.id, t.token_hash, t.checked_in_at, b.status AS booking_status,
               s.label AS seat, sl.starts_at, sl.ends_at, sl.mode,
               e.title, e.venue, e.speaker, e.organizer, e.status AS event_status,
               u.email, u.name
        FROM tickets t
        JOIN bookings b       ON b.id = t.booking_id
        JOIN booking_seats bs ON bs.id = t.booking_seat_id
        JOIN seats s          ON s.id = bs.seat_id
        JOIN event_slots sl   ON sl.id = b.slot_id
        JOIN events e         ON e.id = sl.event_id
        JOIN users u          ON u.id = b.user_id
        WHERE t.id = ?::uuid
        """;

    private final JdbcTemplate jdbc;

    public TicketService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Read-only check. Never changes data. */
    public Map<String, Object> verify(String rawQr) {
        return evaluate(rawQr).response();
    }

    /** Verify, then atomically mark as used. The conditional UPDATE guarantees two scanners cannot both admit the same ticket. */
    @Transactional
    public Map<String, Object> checkIn(String rawQr, String scannedBy) {
        Evaluation ev = evaluate(rawQr);
        if (!"VALID".equals(ev.result())) return ev.response();
        int updated = jdbc.update(
            "UPDATE tickets SET checked_in_at = (now() AT TIME ZONE 'utc'), checked_in_by = ? WHERE id = ?::uuid AND checked_in_at IS NULL",
            scannedBy, ev.ticketId());
        if (updated != 1) return evaluate(rawQr).response(); // lost the race: report ALREADY_USED with the winner's time
        Map<String, Object> out = new LinkedHashMap<>(ev.response());
        out.put("result", "ADMITTED");
        out.put("valid", true);
        out.put("message", "Admit: ticket checked in.");
        return out;
    }

    private record Evaluation(String result, String ticketId, Map<String, Object> response) {}

    private Evaluation evaluate(String rawQr) {
        Optional<QrCode> parsed = QrCode.parse(rawQr);
        if (parsed.isEmpty()) return reject("INVALID", "This is not a CampusConnect ticket.", null);
        QrCode qr = parsed.get();

        List<Map<String, Object>> rows = jdbc.query(SQL, (rs, i) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("tokenHash", rs.getString("token_hash"));
            m.put("checkedInAt", toInstant(rs.getObject("checked_in_at", LocalDateTime.class)));
            m.put("bookingStatus", rs.getString("booking_status"));
            m.put("eventStatus", rs.getString("event_status"));
            m.put("seat", rs.getString("seat"));
            m.put("startsAt", toInstant(rs.getObject("starts_at", LocalDateTime.class)));
            m.put("endsAt", toInstant(rs.getObject("ends_at", LocalDateTime.class)));
            m.put("mode", rs.getString("mode"));
            m.put("title", rs.getString("title"));
            m.put("venue", rs.getString("venue"));
            m.put("speaker", rs.getString("speaker"));
            m.put("organizer", rs.getString("organizer"));
            m.put("email", rs.getString("email"));
            m.put("name", rs.getString("name"));
            return m;
        }, qr.ticketId().toString());

        // Unknown ticket id (also what a cancelled booking looks like: its tickets are deleted) and wrong token look identical.
        if (rows.isEmpty() || !qr.matches((String) rows.get(0).get("tokenHash")))
            return reject("INVALID", "Ticket not found or cancelled.", null);

        Map<String, Object> r = rows.get(0);
        Map<String, Object> details = details(qr, r);
        Instant now = Instant.now();
        Instant start = (Instant) r.get("startsAt");
        Instant end = (Instant) r.get("endsAt");

        boolean eventLive = "PUBLISHED".equals(r.get("eventStatus")) || "COMPLETED".equals(r.get("eventStatus"));
        if (!"CONFIRMED".equals(r.get("bookingStatus")) || !eventLive)
            return reject("INVALID", "Booking or event is no longer active.", details);
        if (r.get("checkedInAt") != null) return reject("ALREADY_USED", "Already checked in.", details);
        if (now.isBefore(start.minus(EARLY_ENTRY))) return reject("TOO_EARLY", "Check-in opens 2 hours before the slot.", details);
        if (now.isAfter(end)) return reject("SLOT_ENDED", "This slot has already ended.", details);

        Map<String, Object> ok = new LinkedHashMap<>(details);
        ok.put("result", "VALID");
        ok.put("valid", true);
        ok.put("message", "Valid ticket.");
        return new Evaluation("VALID", qr.ticketId().toString(), ok);
    }

    private Map<String, Object> details(QrCode qr, Map<String, Object> r) {
        Map<String, Object> d = new LinkedHashMap<>();
        d.put("ticketId", qr.ticketId().toString());
        d.put("attendeeName", r.get("name"));
        d.put("attendeeEmail", r.get("email"));
        d.put("eventTitle", r.get("title"));
        d.put("venue", r.get("venue"));
        d.put("speaker", r.get("speaker"));
        d.put("organizer", r.get("organizer"));
        d.put("seat", r.get("seat"));
        d.put("slotStart", r.get("startsAt"));
        d.put("slotEnd", r.get("endsAt"));
        d.put("mode", r.get("mode"));
        d.put("checkedInAt", r.get("checkedInAt"));
        return d;
    }

    private Evaluation reject(String result, String message, Map<String, Object> details) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (details != null) m.putAll(details);
        m.put("result", result);
        m.put("valid", false);
        m.put("message", message);
        return new Evaluation(result, details == null ? null : (String) details.get("ticketId"), m);
    }

    // Prisma stores TIMESTAMP(3) in UTC without zone, so read as LocalDateTime and tag it UTC (independent of the JVM zone).
    private static Instant toInstant(LocalDateTime t) {
        return t == null ? null : t.toInstant(ZoneOffset.UTC);
    }
}
