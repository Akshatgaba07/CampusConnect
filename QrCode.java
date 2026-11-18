package in.edu.bennett.campusconnect.qr;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/** Parsed form of the QR string: CC1.{ticketId}.{token}. */
public record QrCode(UUID ticketId, String token) {

    public static Optional<QrCode> parse(String raw) {
        if (raw == null) return Optional.empty();
        String[] p = raw.trim().split("\\.", -1);
        if (p.length != 3 || !p[0].equals("CC1") || p[2].isBlank() || p[2].length() > 128) return Optional.empty();
        try {
            return Optional.of(new QrCode(UUID.fromString(p[1]), p[2]));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    /** Hex sha256 of the token, comparable with tickets.token_hash written by the Node backend. */
    public String tokenHash() {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(d);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public boolean matches(String storedHash) {
        return MessageDigest.isEqual(tokenHash().getBytes(StandardCharsets.UTF_8), storedHash.getBytes(StandardCharsets.UTF_8));
    }
}
