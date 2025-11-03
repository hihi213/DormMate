package com.dormmate.backend.modules.fridge.domain;

public final class LabelFormatter {

    private LabelFormatter() {
    }

    public static String toSlotLetter(int slotIndex) {
        if (slotIndex < 0) {
            throw new IllegalArgumentException("slotIndex must be non-negative");
        }

        StringBuilder builder = new StringBuilder();
        int value = slotIndex;
        while (value >= 0) {
            int remainder = value % 26;
            builder.append((char) ('A' + remainder));
            value = value / 26 - 1;
        }
        return builder.reverse().toString();
    }

    public static String toBundleLabel(int slotIndex, int labelNumber) {
        return toSlotLetter(slotIndex) + formatLabelNumber(labelNumber);
    }

    public static String formatLabelNumber(int labelNumber) {
        if (labelNumber <= 0) {
            return "000";
        }
        return String.format("%03d", Math.min(labelNumber, 999));
    }

    public static int fromSlotLetter(String slotLetter) {
        if (slotLetter == null || slotLetter.isBlank()) {
            throw new IllegalArgumentException("slotLetter must not be blank");
        }
        String normalized = slotLetter.trim().toUpperCase();
        int result = 0;
        for (int i = 0; i < normalized.length(); i++) {
            char ch = normalized.charAt(i);
            if (ch < 'A' || ch > 'Z') {
                throw new IllegalArgumentException("Invalid slot letter: " + slotLetter);
            }
            result = result * 26 + (ch - 'A' + 1);
        }
        return result - 1;
    }
}
