package in.edu.bennett.campusconnect.qr;

import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
public class TicketController {
    public record ScanRequest(String qr, String scannedBy) {}

    private final TicketService service;

    public TicketController(TicketService service) {
        this.service = service;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("ok", true);
    }

    @PostMapping("/api/v1/tickets/verify")
    public Map<String, Object> verify(@RequestBody ScanRequest body) {
        return service.verify(body.qr());
    }

    @PostMapping("/api/v1/tickets/check-in")
    public Map<String, Object> checkIn(@RequestBody ScanRequest body) {
        return service.checkIn(body.qr(), body.scannedBy() == null ? "unknown" : body.scannedBy());
    }
}
