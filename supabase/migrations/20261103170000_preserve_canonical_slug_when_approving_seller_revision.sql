-- Preserve the canonical storefront slug when approving a seller revision.
-- The revision row still owns its generated slug until it is retired. Copying
-- that slug to the canonical row first violates products_slug_key.
DO $migration$
DECLARE
  v_definition text;
  v_old text := 'title=v_product.title,slug=v_product.slug,description=v_product.description,';
  v_new text := 'title=v_product.title,description=v_product.description,';
BEGIN
  SELECT pg_get_functiondef('public.transition_seller_product(uuid,text,text,text)'::regprocedure)
  INTO v_definition;

  IF position(v_old IN v_definition) > 0 THEN
    EXECUTE replace(v_definition, v_old, v_new);
  END IF;
END;
$migration$;
