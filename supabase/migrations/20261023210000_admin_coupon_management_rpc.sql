CREATE OR REPLACE FUNCTION public.admin_list_coupons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT public.is_admin_staff() THEN RAISE EXCEPTION 'administrator access required'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'code', c.code, 'description', c.description, 'publicLabel', c.public_label,
    'discountType', c.discount_type, 'discountValue', c.discount_value, 'maxDiscountAmount', c.max_discount_amount,
    'minSubtotal', c.min_subtotal, 'startsAt', c.starts_at, 'endsAt', c.ends_at,
    'totalUsageLimit', c.total_usage_limit, 'perCustomerLimit', c.per_customer_limit,
    'usageCount', c.usage_count, 'firstOrderOnly', c.first_order_only, 'stackable', c.stackable,
    'priority', c.priority, 'status', c.status, 'createdAt', c.created_at,
    'targets', COALESCE((SELECT jsonb_agg(jsonb_build_object('targetType', t.target_type, 'targetId', t.target_id, 'mode', t.mode))
      FROM public.coupon_targets t WHERE t.coupon_id = c.id), '[]'::jsonb)
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_result FROM public.coupons c;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_coupon(p_coupon jsonb, p_targets jsonb, p_coupon_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_before jsonb;
  v_target jsonb;
BEGIN
  IF NOT public.is_admin_staff() THEN RAISE EXCEPTION 'administrator access required'; END IF;
  IF p_coupon IS NULL OR jsonb_typeof(p_coupon) <> 'object' OR jsonb_typeof(COALESCE(p_targets, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'invalid coupon payload';
  END IF;
  IF length(trim(COALESCE(p_coupon->>'code',''))) < 3 OR length(trim(p_coupon->>'code')) > 64 THEN RAISE EXCEPTION 'coupon code must be 3–64 characters'; END IF;
  IF jsonb_array_length(COALESCE(p_targets, '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'select at least one target'; END IF;

  IF p_coupon_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_before FROM public.coupons c WHERE c.id = p_coupon_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'coupon not found'; END IF;
  END IF;

  INSERT INTO public.coupons(
    id, code, description, public_label, discount_type, discount_value, max_discount_amount, min_subtotal,
    starts_at, ends_at, total_usage_limit, per_customer_limit, first_order_only, stackable, priority, status, created_by, updated_at
  ) VALUES (
    COALESCE(p_coupon_id, gen_random_uuid()), upper(trim(p_coupon->>'code')),
    NULLIF(trim(p_coupon->>'description'), ''), NULLIF(trim(p_coupon->>'publicLabel'), ''),
    (p_coupon->>'discountType')::public.coupon_discount_type, (p_coupon->>'discountValue')::numeric,
    NULLIF(p_coupon->>'maxDiscountAmount','')::numeric, COALESCE(NULLIF(p_coupon->>'minSubtotal','')::numeric,0),
    NULLIF(p_coupon->>'startsAt','')::timestamptz, NULLIF(p_coupon->>'endsAt','')::timestamptz,
    NULLIF(p_coupon->>'totalUsageLimit','')::integer, COALESCE(NULLIF(p_coupon->>'perCustomerLimit','')::integer,1),
    COALESCE((p_coupon->>'firstOrderOnly')::boolean,false), COALESCE((p_coupon->>'stackable')::boolean,false),
    COALESCE(NULLIF(p_coupon->>'priority','')::integer,100), COALESCE((p_coupon->>'status')::public.coupon_status,'DRAFT'),
    auth.uid(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    code=EXCLUDED.code, description=EXCLUDED.description, public_label=EXCLUDED.public_label,
    discount_type=EXCLUDED.discount_type, discount_value=EXCLUDED.discount_value,
    max_discount_amount=EXCLUDED.max_discount_amount, min_subtotal=EXCLUDED.min_subtotal,
    starts_at=EXCLUDED.starts_at, ends_at=EXCLUDED.ends_at, total_usage_limit=EXCLUDED.total_usage_limit,
    per_customer_limit=EXCLUDED.per_customer_limit, first_order_only=EXCLUDED.first_order_only,
    stackable=EXCLUDED.stackable, priority=EXCLUDED.priority, status=EXCLUDED.status, updated_at=now()
  RETURNING * INTO v_coupon;

  DELETE FROM public.coupon_targets WHERE coupon_id = v_coupon.id;
  FOR v_target IN SELECT value FROM jsonb_array_elements(COALESCE(p_targets, '[]'::jsonb)) LOOP
    IF (v_target->>'targetType') NOT IN ('PRODUCT','CATEGORY','ALL_PRODUCTS') THEN
      RAISE EXCEPTION 'unsupported target type for this catalog';
    END IF;
    IF (v_target->>'mode') NOT IN ('INCLUDE','EXCLUDE') THEN RAISE EXCEPTION 'invalid target mode'; END IF;
    IF (v_target->>'targetType') = 'ALL_PRODUCTS' THEN
      INSERT INTO public.coupon_targets(coupon_id,target_type,target_id,mode)
      VALUES(v_coupon.id,'ALL_PRODUCTS',NULL,(v_target->>'mode')::public.coupon_target_mode);
    ELSIF (v_target->>'targetType') = 'PRODUCT' THEN
      IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=(v_target->>'targetId')::uuid) THEN RAISE EXCEPTION 'product target not found'; END IF;
      INSERT INTO public.coupon_targets(coupon_id,target_type,target_id,mode)
      VALUES(v_coupon.id,'PRODUCT',(v_target->>'targetId')::uuid,(v_target->>'mode')::public.coupon_target_mode);
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id=(v_target->>'targetId')::uuid) THEN RAISE EXCEPTION 'category target not found'; END IF;
      INSERT INTO public.coupon_targets(coupon_id,target_type,target_id,mode)
      VALUES(v_coupon.id,'CATEGORY',(v_target->>'targetId')::uuid,(v_target->>'mode')::public.coupon_target_mode);
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs(actor_user_id, action, entity_type, entity_id, summary, before_data, after_data)
  VALUES(auth.uid(), CASE WHEN p_coupon_id IS NULL THEN 'create' ELSE 'update' END, 'coupon', v_coupon.id,
    CASE WHEN p_coupon_id IS NULL THEN 'Created coupon ' || v_coupon.code ELSE 'Updated coupon ' || v_coupon.code END,
    v_before, to_jsonb(v_coupon));
  RETURN jsonb_build_object('id',v_coupon.id,'code',v_coupon.code,'status',v_coupon.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_coupon_status(p_coupon_id uuid, p_status public.coupon_status)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_before jsonb; v_after public.coupons%ROWTYPE;
BEGIN
  IF NOT public.is_admin_staff() THEN RAISE EXCEPTION 'administrator access required'; END IF;
  SELECT to_jsonb(c) INTO v_before FROM public.coupons c WHERE c.id=p_coupon_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'coupon not found'; END IF;
  UPDATE public.coupons SET status=p_status, updated_at=now() WHERE id=p_coupon_id RETURNING * INTO v_after;
  INSERT INTO public.activity_logs(actor_user_id,action,entity_type,entity_id,summary,before_data,after_data)
  VALUES(auth.uid(),'status_change','coupon',v_after.id,'Changed coupon '||v_after.code||' to '||p_status::text,v_before,to_jsonb(v_after));
  RETURN jsonb_build_object('id',v_after.id,'status',v_after.status);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_coupons() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_coupon(jsonb,jsonb,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_coupon_status(uuid,public.coupon_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_coupons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_coupon(jsonb,jsonb,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_coupon_status(uuid,public.coupon_status) TO authenticated;

-- Safe draft examples only; never activate sample discounts automatically.
INSERT INTO public.coupons(code,description,public_label,discount_type,discount_value,status,per_customer_limit)
VALUES('WELCOME10','Example product-scoped coupon','10% off selected study resources','PERCENTAGE',10,'DRAFT',1)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.coupon_targets(coupon_id,target_type,target_id,mode)
SELECT c.id,'PRODUCT',p.id,'INCLUDE'
FROM public.coupons c CROSS JOIN LATERAL (SELECT id FROM public.products ORDER BY created_at LIMIT 1) p
WHERE c.code='WELCOME10' AND NOT EXISTS (SELECT 1 FROM public.coupon_targets t WHERE t.coupon_id=c.id);
INSERT INTO public.coupons(code,description,public_label,discount_type,discount_value,status,per_customer_limit)
VALUES('CATEGORY15','Example category coupon with exclusion','15% off a category','PERCENTAGE',15,'DRAFT',1)
ON CONFLICT(code) DO NOTHING;
INSERT INTO public.coupon_targets(coupon_id,target_type,target_id,mode)
SELECT c.id,'CATEGORY',cat.id,'INCLUDE'
FROM public.coupons c CROSS JOIN LATERAL (SELECT id FROM public.categories ORDER BY sort_order LIMIT 1) cat
WHERE c.code='CATEGORY15' AND NOT EXISTS (SELECT 1 FROM public.coupon_targets t WHERE t.coupon_id=c.id);
INSERT INTO public.coupon_targets(coupon_id,target_type,target_id,mode)
SELECT c.id,'PRODUCT',p.id,'EXCLUDE'
FROM public.coupons c CROSS JOIN LATERAL (SELECT id FROM public.products ORDER BY created_at DESC LIMIT 1) p
WHERE c.code='CATEGORY15' AND NOT EXISTS (SELECT 1 FROM public.coupon_targets t WHERE t.coupon_id=c.id AND t.mode='EXCLUDE');
