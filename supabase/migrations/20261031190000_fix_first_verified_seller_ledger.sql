-- Fix first verified marketplace payment accounting.
-- The prior trigger emitted sale_adjustment_credit on the first verification,
-- but seller_ledger intentionally permits only sale_credit/commission_debit.
CREATE OR REPLACE FUNCTION public.append_seller_sale_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.seller_id IS NOT NULL AND NEW.seller_share IS NOT NULL
       AND NEW.payment_status::text = 'verified' THEN
      INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
      VALUES(NEW.seller_id,NEW.id,'sale_credit',NEW.seller_share,'Seller net sale credit');
      INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
      VALUES(NEW.seller_id,NEW.id,'commission_debit',COALESCE(NEW.commission_amount,0),'Marketplace commission captured at order time');
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.refunded IS FALSE AND NEW.refunded IS TRUE
     AND OLD.seller_id IS NOT NULL AND OLD.seller_share IS NOT NULL THEN
    INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    VALUES(OLD.seller_id,OLD.id,'sale_reversal',OLD.seller_share,'Refund reversal of seller sale credit');
    RETURN NEW;
  END IF;

  IF OLD.payment_status::text <> 'verified'
     AND NEW.payment_status::text = 'verified'
     AND NEW.seller_id IS NOT NULL AND NEW.seller_share IS NOT NULL
     AND OLD.seller_id IS NULL THEN
    INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    VALUES(NEW.seller_id,NEW.id,'sale_credit',NEW.seller_share,'Seller net sale credit');
    INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    VALUES(NEW.seller_id,NEW.id,'commission_debit',COALESCE(NEW.commission_amount,0),'Marketplace commission captured at order time');
    RETURN NEW;
  END IF;

  IF OLD.seller_id IS DISTINCT FROM NEW.seller_id
     AND NEW.seller_id IS NOT NULL AND NEW.seller_share IS NOT NULL THEN
    IF OLD.seller_id IS NOT NULL AND OLD.seller_share IS NOT NULL THEN
      INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
      VALUES(OLD.seller_id,OLD.id,'sale_reversal',OLD.seller_share,'Prior seller sale allocation reversed by order correction');
    END IF;
    INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    VALUES(NEW.seller_id,NEW.id,'sale_credit',NEW.seller_share,'Corrected seller sale allocation credited');
    INSERT INTO public.seller_ledger(seller_id,order_id,entry_type,amount,description)
    VALUES(NEW.seller_id,NEW.id,'commission_debit',COALESCE(NEW.commission_amount,0),'Corrected marketplace commission');
  END IF;

  RETURN NEW;
END;
$function$;
