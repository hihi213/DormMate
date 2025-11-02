ALTER TABLE inspection_action
    ADD COLUMN correlation_id uuid DEFAULT gen_random_uuid();

UPDATE inspection_action
SET correlation_id = gen_random_uuid()
WHERE correlation_id IS NULL;

ALTER TABLE inspection_action
    ALTER COLUMN correlation_id SET NOT NULL;

ALTER TABLE inspection_action_item
    ADD COLUMN correlation_id uuid;

UPDATE inspection_action_item i
SET correlation_id = a.correlation_id
FROM inspection_action a
WHERE i.inspection_action_id = a.id;

UPDATE inspection_action_item
SET correlation_id = gen_random_uuid()
WHERE correlation_id IS NULL;

ALTER TABLE inspection_action_item
    ALTER COLUMN correlation_id SET NOT NULL;

ALTER TABLE penalty_history
    ADD COLUMN correlation_id uuid;

UPDATE penalty_history ph
SET correlation_id = ia.correlation_id
FROM inspection_action ia
WHERE ph.inspection_action_id = ia.id
  AND ph.correlation_id IS NULL;

ALTER TABLE inspection_schedule
    ADD COLUMN fridge_compartment_id uuid;
