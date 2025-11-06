-- Helper to convert zero-based slot index to alphabetical code (A, B, ... , Z, AA, AB, ...)
-- Mirrors backend LabelFormatter.toSlotLetter behaviour so SQL queries can reuse identical logic.
CREATE OR REPLACE FUNCTION public.fn_slot_letter(slot_index INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
    v_index INTEGER := slot_index;
    v_result TEXT := '';
    v_remainder INTEGER;
BEGIN
    IF v_index IS NULL THEN
        RAISE EXCEPTION 'slot_index must not be null';
    END IF;
    IF v_index < 0 THEN
        RAISE EXCEPTION 'slot_index must be non-negative (got %)', v_index;
    END IF;

    LOOP
        v_remainder := v_index % 26;
        v_result := chr(65 + v_remainder) || v_result;
        v_index := v_index / 26 - 1;
        EXIT WHEN v_index < 0;
    END LOOP;

    RETURN v_result;
END;
$function$;
