package com.dormmate.backend.global.error;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class ProblemException extends ResponseStatusException {

    private static final String DEFAULT_TYPE_PREFIX = "urn:problem:dormmate:";

    private final String code;
    private final String detail;
    private final String type;

    public ProblemException(HttpStatus status, String code) {
        this(status, code, null, null);
    }

    public ProblemException(HttpStatus status, String code, String detail) {
        this(status, code, detail, null);
    }

    public ProblemException(HttpStatus status, String code, String detail, String typeOverride) {
        super(status, code);
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("ProblemException code must not be blank");
        }
        this.code = code;
        this.detail = (detail != null && !detail.isBlank()) ? detail : code;
        if (typeOverride != null && !typeOverride.isBlank()) {
            this.type = typeOverride;
        } else {
            String normalized = code.toLowerCase().replaceAll("[^a-z0-9\\-_.:]+", "-");
            this.type = DEFAULT_TYPE_PREFIX + normalized;
        }
    }

    public String getCode() {
        return code;
    }

    public String getDetailMessage() {
        return detail;
    }

    public String getProblemType() {
        return type;
    }
}
