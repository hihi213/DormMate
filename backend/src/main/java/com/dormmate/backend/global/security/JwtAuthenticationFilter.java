package com.dormmate.backend.global.security;

import java.io.IOException;
import java.util.List;

import com.dormmate.backend.modules.auth.application.JwtTokenService;
import com.dormmate.backend.modules.auth.application.JwtTokenService.InvalidTokenException;
import com.dormmate.backend.modules.auth.application.JwtTokenService.ParsedToken;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";
    private final JwtTokenService jwtTokenService;

    public JwtAuthenticationFilter(JwtTokenService jwtTokenService) {
        this.jwtTokenService = jwtTokenService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.startsWith(BEARER_PREFIX)) {
            String token = authorization.substring(BEARER_PREFIX.length());
            try {
                ParsedToken parsed = jwtTokenService.parseAccessToken(token);
                List<SimpleGrantedAuthority> authorities = parsed.roles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                        .toList();

                JwtAuthenticationPrincipal principal = new JwtAuthenticationPrincipal(
                        parsed.userId(),
                        parsed.loginId(),
                        parsed.roles()
                );

                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(principal, token, authorities);
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (InvalidTokenException ex) {
                SecurityContextHolder.clearContext();
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "INVALID_ACCESS_TOKEN", ex);
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        if (request.getMethod().equalsIgnoreCase("OPTIONS")) {
            return true;
        }
        return path.startsWith("/auth/") || path.startsWith("/health") || path.startsWith("/actuator");
    }
}
