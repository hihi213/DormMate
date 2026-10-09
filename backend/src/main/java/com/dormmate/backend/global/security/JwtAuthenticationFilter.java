package com.dormmate.backend.global.security;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import com.dormmate.backend.global.error.ProblemResponse;
import com.dormmate.backend.modules.auth.application.JwtTokenService;
import com.dormmate.backend.modules.auth.application.JwtTokenService.InvalidTokenException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.lang.NonNull;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtTokenService tokens;
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    public JwtAuthenticationFilter(JwtTokenService tokens, JdbcTemplate jdbc, ObjectMapper mapper) {
        this.tokens = tokens; this.jdbc = jdbc; this.mapper = mapper;
    }
    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                var parsed = tokens.parseAccessToken(header.substring(7));
                var rows = jdbc.queryForList("SELECT status,retired_at,must_change_password,credential_version FROM dorm_user WHERE id=?", parsed.userId());
                if (rows.isEmpty() || !"ACTIVE".equals(rows.get(0).get("status"))
                        || rows.get(0).get("retired_at") != null
                        || ((Number) rows.get(0).get("credential_version")).longValue() != parsed.credentialVersion()) {
                    reject(request, response, HttpStatus.UNAUTHORIZED, "CREDENTIALS_CHANGED"); return;
                }
                if (Boolean.TRUE.equals(rows.get(0).get("must_change_password"))
                        && !("POST".equals(request.getMethod()) && "/auth/password".equals(request.getServletPath()))) {
                    reject(request, response, HttpStatus.FORBIDDEN, "PASSWORD_CHANGE_REQUIRED"); return;
                }
                List<String> roles = jdbc.queryForList("SELECT role_code FROM user_role WHERE dorm_user_id=? AND revoked_at IS NULL", String.class, parsed.userId());
                var principal = new JwtAuthenticationPrincipal(parsed.userId(), parsed.loginId(), roles, parsed.credentialVersion());
                var auth = new UsernamePasswordAuthenticationToken(principal, null,
                        roles.stream().map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList());
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (InvalidTokenException ex) {
                reject(request, response, HttpStatus.UNAUTHORIZED, "INVALID_ACCESS_TOKEN"); return;
            }
        }
        chain.doFilter(request, response);
    }
    private void reject(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String code) throws IOException {
        SecurityContextHolder.clearContext();
        response.setStatus(status.value()); response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), ProblemResponse.of(status, code, code, request.getRequestURI()));
    }
    @Override protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        return "OPTIONS".equals(request.getMethod()) || Set.of("/auth/login", "/auth/refresh", "/auth/logout",
                "/health", "/healthz", "/readyz").contains(request.getServletPath());
    }
}
