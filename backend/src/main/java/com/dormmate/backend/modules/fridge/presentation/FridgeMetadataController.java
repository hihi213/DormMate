package com.dormmate.backend.modules.fridge.presentation;

import com.dormmate.backend.modules.fridge.application.FridgeMetadataService;
import com.dormmate.backend.modules.fridge.application.FridgeMetadataService.FridgeCompartmentMeta;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;

@RestController
public class FridgeMetadataController {

    private final FridgeMetadataService metadataService;

    public FridgeMetadataController(FridgeMetadataService metadataService) {
        this.metadataService = metadataService;
    }

    @Operation(
            summary = "냉장고 칸 메타데이터",
            description = "기본 응답은 compartment id 위주이며, view=full 시 표시용 정렬 순서 및 상세 정보를 포함합니다.",
            responses = {
                    @ApiResponse(responseCode = "200", content = @Content(array = @ArraySchema(schema = @Schema(implementation = CompartmentMeta.class))))
            }
    )
    @GetMapping("/api/fridge/compartments")
    public List<?> getCompartments(
            @Parameter(description = "full 지정 시 displayOrder/name 등의 확장 필드 제공")
            @RequestParam(name = "view", required = false) String view,
            @Parameter(description = "조회할 층 (기본값 2층)")
            @RequestParam(name = "floor", required = false) Integer floor
    ) {
        int resolvedFloor = Objects.requireNonNullElse(floor, 2);
        List<FridgeCompartmentMeta> metas = metadataService.findByFloor(resolvedFloor);

        if (!"full".equalsIgnoreCase(view)) {
            return metas.stream()
                    .map(meta -> new BasicCompartment(meta.id()))
                    .toList();
        }

        return metas.stream()
                .map(meta -> new CompartmentMeta(
                        meta.id(),
                        meta.floor(),
                        meta.displayOrder(),
                        meta.type(),
                        meta.labelRangeStart(),
                        meta.labelRangeEnd(),
                        meta.displayName()
                ))
                .toList();
    }

    public record CompartmentMeta(
            Long id,
            Integer floor,
            Integer displayOrder,
            String type,
            Integer labelRangeStart,
            Integer labelRangeEnd,
            String displayName
    ) {
        @JsonProperty("floorCode")
        public String floorCode() {
            if (floor == null) {
                return "";
            }
            return floor + "F";
        }

        @JsonProperty("displayCode")
        public String displayCode() {
            if (displayOrder == null || displayOrder < 1) return "";
            return String.valueOf(displayOrder);
        }
    }

    public record BasicCompartment(Long id) {}
}
