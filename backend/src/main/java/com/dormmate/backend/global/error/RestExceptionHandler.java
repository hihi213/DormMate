package com.dormmate.backend.global.error;

import com.dormmate.backend.global.error.ProblemResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.server.ResponseStatusException;

@ControllerAdvice
public class RestExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ProblemResponse> handleResponseStatusException(ResponseStatusException ex) {
        HttpStatusCode statusCode = ex.getStatusCode();
        HttpStatus status = statusCode instanceof HttpStatus httpStatus
                ? httpStatus
                : HttpStatus.valueOf(statusCode.value());
        String message = ex.getReason() != null ? ex.getReason() : status.getReasonPhrase();
        ProblemResponse body = ProblemResponse.of(status, message, message, null);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemResponse> handleValidationException(MethodArgumentNotValidException ex) {
        HttpStatus status = HttpStatus.UNPROCESSABLE_ENTITY;
        StringBuilder sb = new StringBuilder();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            sb.append(fieldError.getField()).append(": ").append(fieldError.getDefaultMessage()).append("; ");
        }
        String detail = sb.length() > 0 ? sb.substring(0, sb.length() - 2) : "Validation failed";
        ProblemResponse body = ProblemResponse.of(status, "validation_error", detail, null);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemResponse> handleGenericException(Exception ex) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        ProblemResponse body = ProblemResponse.of(status, "internal_error", ex.getMessage(), null);
        return ResponseEntity.status(status).body(body);
    }
}
