package com.dormmate.backend.fridge;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class FridgeMetadataController {

    private static final List<CompartmentMeta> BASIC_RESPONSE = List.of(
            new CompartmentMeta(2101L, 1, "2층 냉장 1칸", 1, 999),
            new CompartmentMeta(2102L, 2, "2층 냉장 2칸", 1, 999),
            new CompartmentMeta(2103L, 3, "2층 냉동 1칸", 1, 999),
            new CompartmentMeta(3101L, 1, "3층 냉장 1칸", 1, 999)
    );

    @Operation(
            summary = "냉장고 칸 메타데이터",
            description = "기본 응답은 compartment id 위주이며, view=full 시 표시용 정렬 순서를 포함합니다.",
            responses = {
                    @ApiResponse(responseCode = "200", content = @Content(array = @ArraySchema(schema = @Schema(implementation = CompartmentMeta.class))))
            }
    )
    @GetMapping("/api/fridge/compartments")
    public List<?> getCompartments(
            @Parameter(description = "full 지정 시 displayOrder/name 등의 확장 필드 제공")
            @RequestParam(name = "view", required = false) String view
    ) {
        if ("full".equalsIgnoreCase(view)) {
            return BASIC_RESPONSE;
        }
        return BASIC_RESPONSE.stream()
                .map(meta -> new BasicCompartment(meta.id()))
                .toList();
    }

    public record CompartmentMeta(Long id, Integer displayOrder, String displayName,
                                  Integer labelRangeStart, Integer labelRangeEnd) {
        @JsonProperty("displayCode")
        public String displayCode() {
            if (displayOrder == null || displayOrder < 1) return "";
            int n = displayOrder;
            StringBuilder sb = new StringBuilder();
            while (n > 0) {
                int idx = (n - 1) % 26;
                sb.insert(0, (char) ('A' + idx));
                n = (n - 1) / 26;
            }
            return sb.toString();
        }
    }

    public record BasicCompartment(Long id) {}
}
