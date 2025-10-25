package com.dormmate.backend.modules.fridge.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Service
public class FridgeMetadataService {

    private final JdbcTemplate jdbcTemplate;

    public FridgeMetadataService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<FridgeCompartmentMeta> findByFloor(int floor) {
        String sql = """
                SELECT c.id,
                       fu.floor,
                       c.display_order,
                       c.type,
                       c.label_range_start,
                       c.label_range_end
                FROM compartments c
                JOIN fridge_units fu ON fu.id = c.unit_id
                WHERE fu.floor = ?
                ORDER BY c.display_order
                """;
        return jdbcTemplate.query(sql, new FridgeCompartmentMetaRowMapper(), floor);
    }

    static class FridgeCompartmentMetaRowMapper implements RowMapper<FridgeCompartmentMeta> {
        @Override
        public FridgeCompartmentMeta mapRow(ResultSet rs, int rowNum) throws SQLException {
            Long id = rs.getLong("id");
            Integer floor = rs.getInt("floor");
            Integer displayOrder = rs.getInt("display_order");
            String type = rs.getString("type");
            Integer labelRangeStart = rs.getInt("label_range_start");
            Integer labelRangeEnd = rs.getInt("label_range_end");

            String typeName = "냉장";
            if ("FREEZER".equalsIgnoreCase(type)) {
                typeName = "냉동";
            }
            String displayName = String.format("%d층 %s %d칸", floor, typeName, displayOrder);

            return new FridgeCompartmentMeta(
                    id,
                    floor,
                    displayOrder,
                    type,
                    labelRangeStart,
                    labelRangeEnd,
                    displayName
            );
        }
    }

    public record FridgeCompartmentMeta(
            Long id,
            Integer floor,
            Integer displayOrder,
            String type,
            Integer labelRangeStart,
            Integer labelRangeEnd,
            String displayName
    ) {}
}
