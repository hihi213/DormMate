package com.dormmate.backend.global.error;

import org.springframework.http.HttpStatus;

public record ProblemResponse(String type, String title, int status, String detail, String instance, String code) {

    private static final String DEFAULT_TYPE_PREFIX = "https://dormmate.app/errors/";

    public static ProblemResponse of(HttpStatus httpStatus, String code, String detail, String instance) {
        String safeCode = (code != null && !code.isBlank()) ? code : httpStatus.name();
        String normalized = safeCode.toLowerCase().replaceAll("[^a-z0-9\\-_.]+", "-");
        String safeDetail = (detail != null && !detail.isBlank()) ? detail : httpStatus.getReasonPhrase();
        String type = DEFAULT_TYPE_PREFIX + normalized;
        return new ProblemResponse(type, httpStatus.getReasonPhrase(), httpStatus.value(), safeDetail, instance, safeCode);
    }
}
