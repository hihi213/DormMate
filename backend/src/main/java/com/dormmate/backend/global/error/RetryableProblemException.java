package com.dormmate.backend.global.error;

import org.springframework.http.HttpStatus;

public class RetryableProblemException extends ProblemException {

    private final int retryAfterSeconds;

    public RetryableProblemException(HttpStatus status, String code, String detail, int retryAfterSeconds) {
        super(status, code, detail);
        if (retryAfterSeconds < 0) {
            throw new IllegalArgumentException("retryAfterSeconds must be >= 0");
        }
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public RetryableProblemException(HttpStatus status, String code, int retryAfterSeconds) {
        this(status, code, null, retryAfterSeconds);
    }

    public int getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
