package com.dormmate.backend.modules.fridge.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class LabelFormatterTest {

    @Test
    @DisplayName("slotIndex를 알파벳 코드로 변환한다")
    void toSlotLetter() {
        assertThat(LabelFormatter.toSlotLetter(0)).isEqualTo("A");
        assertThat(LabelFormatter.toSlotLetter(25)).isEqualTo("Z");
        assertThat(LabelFormatter.toSlotLetter(26)).isEqualTo("AA");
        assertThat(LabelFormatter.toSlotLetter(27)).isEqualTo("AB");
        assertThat(LabelFormatter.toSlotLetter(51)).isEqualTo("AZ");
        assertThat(LabelFormatter.toSlotLetter(52)).isEqualTo("BA");
    }

    @Test
    @DisplayName("음수 slotIndex는 예외를 발생시킨다")
    void toSlotLetter_negative() {
        assertThatThrownBy(() -> LabelFormatter.toSlotLetter(-1))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("라벨 번호는 3자리 문자열로 포맷된다")
    void formatLabelNumber() {
        assertThat(LabelFormatter.formatLabelNumber(1)).isEqualTo("001");
        assertThat(LabelFormatter.formatLabelNumber(999)).isEqualTo("999");
        assertThat(LabelFormatter.formatLabelNumber(1000)).isEqualTo("999");
        assertThat(LabelFormatter.formatLabelNumber(0)).isEqualTo("000");
    }
}
