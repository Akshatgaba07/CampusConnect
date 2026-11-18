package in.edu.bennett.campusconnect.qr;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class QrCodeTest {
    private static final String ID = "11111111-1111-1111-1111-111111111111";

    @Test
    void parsesWellFormedQr() {
        var qr = QrCode.parse("CC1." + ID + ".abcDEF_-123").orElseThrow();
        assertEquals(ID, qr.ticketId().toString());
        assertEquals("abcDEF_-123", qr.token());
    }

    @Test
    void rejectsMalformedQr() {
        assertTrue(QrCode.parse(null).isEmpty());
        assertTrue(QrCode.parse("hello").isEmpty());
        assertTrue(QrCode.parse("CC2." + ID + ".tok").isEmpty());
        assertTrue(QrCode.parse("CC1.not-a-uuid.tok").isEmpty());
        assertTrue(QrCode.parse("CC1." + ID + ".a.b").isEmpty());
    }

    @Test
    void hashMatchesNodeSha256Hex() {
        // sha256("abc") in hex; the Node backend stores sha256(token) as lowercase hex
        var qr = QrCode.parse("CC1." + ID + ".abc").orElseThrow();
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", qr.tokenHash());
        assertTrue(qr.matches("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
        assertFalse(qr.matches("00"));
    }
}
