package com.dormmate.backend.modules.fridge.infrastructure.persistence;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import com.dormmate.backend.modules.fridge.domain.FridgeBundle;
import com.dormmate.backend.modules.fridge.domain.FridgeBundleStatus;

@Repository
public class FridgeBundleRepositoryImpl implements FridgeBundleRepositoryCustom {

    private static final String STATUS_PARAM = "statuses";

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<FridgeBundle> searchBundles(FridgeBundleSearchCondition condition, Pageable pageable) {
        Objects.requireNonNull(condition, "condition must not be null");
        Objects.requireNonNull(pageable, "pageable must not be null");

        List<String> whereClauses = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();

        Set<FridgeBundleStatus> statuses = condition.statuses();
        if (CollectionUtils.isEmpty(statuses)) {
            throw new IllegalArgumentException("At least one status must be provided");
        }
        params.put(STATUS_PARAM, statuses.stream().map(Enum::name).toList());
        whereClauses.add("fb.status in (:" + STATUS_PARAM + ")");

        if (condition.compartmentId() != null) {
            whereClauses.add("fb.fridge_compartment_id = :compartmentId");
            params.put("compartmentId", condition.compartmentId());
        }

        if (condition.ownerId() != null) {
            whereClauses.add("fb.owner_user_id = :ownerId");
            params.put("ownerId", condition.ownerId());
        }

        if (condition.exactSlotIndex() != null && condition.exactLabelNumber() != null) {
            whereClauses.add("(fc.slot_index = :slotIndexExact AND fb.label_number = :labelNumberExact)");
            params.put("slotIndexExact", condition.exactSlotIndex());
            params.put("labelNumberExact", condition.exactLabelNumber());
        }

        if (condition.deletedSince() != null) {
            whereClauses.add("fb.deleted_at IS NOT NULL");
            whereClauses.add("fb.deleted_at >= :deletedSince");
            params.put("deletedSince", condition.deletedSince());
        }

        boolean hasKeyword = StringUtils.hasText(condition.keyword());
        if (hasKeyword) {
            String keywordParam = "%" + condition.keyword().toLowerCase(Locale.ROOT) + "%";
            whereClauses.add(buildKeywordClause(condition, params));
            params.put("keyword", keywordParam);
        }

        String baseJoin = " FROM fridge_bundle fb "
                + " JOIN fridge_compartment fc ON fc.id = fb.fridge_compartment_id "
                + " LEFT JOIN dorm_user du ON du.id = fb.owner_user_id ";

        String whereSql = whereClauses.isEmpty() ? "" : " WHERE " + String.join(" AND ", whereClauses);

        String countSql = "SELECT COUNT(*)" + baseJoin + whereSql;

        Query countQuery = entityManager.createNativeQuery(countSql);
        applyParameters(countQuery, params);
        Number total = (Number) countQuery.getSingleResult();

        FridgeBundleSearchOrder order = condition.order() == null
                ? FridgeBundleSearchOrder.CREATED_AT_DESC
                : condition.order();
        String orderBy = order == FridgeBundleSearchOrder.DELETED_AT_DESC
                ? " ORDER BY fb.deleted_at DESC NULLS LAST, fb.id"
                : " ORDER BY fb.created_at DESC, fb.id";
        String dataSql = "SELECT fb.id" + baseJoin + whereSql + orderBy + " LIMIT :limit OFFSET :offset";

        Query dataQuery = entityManager.createNativeQuery(dataSql);
        applyParameters(dataQuery, params);
        dataQuery.setParameter("limit", pageable.getPageSize());
        dataQuery.setParameter("offset", (long) pageable.getPageNumber() * pageable.getPageSize());

        @SuppressWarnings("unchecked")
        List<Object> rawIds = dataQuery.getResultList();

        List<UUID> ids = rawIds.stream()
                .map(value -> {
                    if (value instanceof UUID uuid) {
                        return uuid;
                    }
                    return UUID.fromString(value.toString());
                })
                .toList();

        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, total.longValue());
        }

        List<FridgeBundle> bundles = entityManager.createQuery("""
                        select distinct fb
                          from FridgeBundle fb
                          left join fetch fb.owner
                          left join fetch fb.fridgeCompartment fc
                          left join fetch fc.fridgeUnit
                          left join fetch fb.items items
                         where fb.id in :ids
                        """, FridgeBundle.class)
                .setParameter("ids", ids)
                .getResultList();

        Map<UUID, FridgeBundle> ordered = new LinkedHashMap<>();
        Map<UUID, Integer> index = new HashMap<>();
        for (int i = 0; i < ids.size(); i++) {
            index.put(ids.get(i), i);
        }
        bundles.sort((a, b) -> Integer.compare(index.getOrDefault(a.getId(), Integer.MAX_VALUE),
                index.getOrDefault(b.getId(), Integer.MAX_VALUE)));
        for (FridgeBundle bundle : bundles) {
            ordered.put(bundle.getId(), bundle);
        }

        return new PageImpl<>(new ArrayList<>(ordered.values()), pageable, total.longValue());
    }

    private static void applyParameters(Query query, Map<String, Object> params) {
        params.forEach(query::setParameter);
    }

    private static String buildKeywordClause(FridgeBundleSearchCondition condition, Map<String, Object> params) {
        List<String> parts = new ArrayList<>();
        parts.add("lower(fb.bundle_name) like :keyword");
        parts.add("lower(to_char(fb.label_number, 'FM000')) like :keyword");
        parts.add("lower(public.fn_slot_letter(fc.slot_index) || to_char(fb.label_number, 'FM000')) like :keyword");
        parts.add("lower(public.fn_slot_letter(fc.slot_index) || '-' || to_char(fb.label_number, 'FM000')) like :keyword");
        if (!CollectionUtils.isEmpty(condition.slotLetterIndices())) {
            int index = 0;
            for (Integer slotIndex : condition.slotLetterIndices()) {
                String param = "slotIdxKeyword" + index++;
                parts.add("fc.slot_index = :" + param);
                params.put(param, slotIndex);
            }
        }
        parts.add("lower(coalesce(du.full_name, '')) like :keyword");
        parts.add(
                "EXISTS (SELECT 1 FROM room_assignment ra JOIN room rm ON rm.id = ra.room_id "
                        + "WHERE ra.dorm_user_id = fb.owner_user_id "
                        + "AND ra.released_at IS NULL "
                        + "AND (lower(rm.room_number) like :keyword "
                        + "OR lower(concat(rm.floor, 'f ', rm.room_number)) like :keyword))");
        if (condition.searchItems()) {
            parts.add("EXISTS (SELECT 1 FROM fridge_item fi WHERE fi.fridge_bundle_id = fb.id AND lower(fi.item_name) like :keyword)");
        }
        return "(" + String.join(" OR ", parts) + ")";
    }
}
