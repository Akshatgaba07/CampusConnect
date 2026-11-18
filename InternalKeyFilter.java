package in.edu.bennett.campusconnect.qr;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/** Only the Node backend (which knows INTERNAL_API_KEY) may call /api/**. The service is never exposed through NGINX. */
@Component
public class InternalKeyFilter extends OncePerRequestFilter {
    private final byte[] expected;

    public InternalKeyFilter(@Value("${internal.api-key}") String key) {
        this.expected = key.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String given = req.getHeader("X-Internal-Key");
        boolean ok = given != null && MessageDigest.isEqual(expected, given.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            res.setContentType("application/json");
            res.getWriter().write("{\"error\":\"unauthorized\"}");
            return;
        }
        chain.doFilter(req, res);
    }
}
