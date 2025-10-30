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
}
