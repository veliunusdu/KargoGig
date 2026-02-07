-- ============================================================
-- RPC: credit_company_wallet_for_payment
-- ============================================================
-- Called automatically when payment status = 'paid'.
-- Credits the company wallet with the payment amount.
-- Idempotent: checks if wallet_transaction already exists.

CREATE OR REPLACE FUNCTION public.credit_company_wallet_for_payment(p_payment_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_wallet_id bigint;
  v_existing_tx bigint;
  v_new_balance numeric;
BEGIN
  -- 1) Find payment
  SELECT id, company_id, amount, currency, status
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'payment_not_found'
    );
  END IF;

  -- 2) Verify payment is paid
  IF v_payment.status <> 'paid' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'payment_not_paid',
      'status', v_payment.status
    );
  END IF;

  -- 3) Check if wallet_transaction already exists (idempotency)
  SELECT id INTO v_existing_tx
  FROM public.wallet_transactions
  WHERE reference_type = 'payment'
    AND reference_id = p_payment_id
    AND type = 'credit'
  LIMIT 1;

  IF FOUND THEN
    -- Already credited, return success (idempotent)
    RETURN jsonb_build_object(
      'ok', true,
      'already_credited', true,
      'transaction_id', v_existing_tx
    );
  END IF;

  -- 4) Find or create company wallet
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE owner_type = 'company'
    AND owner_id = v_payment.company_id;

  IF NOT FOUND THEN
    -- Create wallet
    INSERT INTO public.wallets (owner_type, owner_id, balance, currency)
    VALUES ('company', v_payment.company_id, 0, v_payment.currency)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- 5) Credit wallet (atomic update)
  UPDATE public.wallets
  SET balance = balance + v_payment.amount,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- 6) Insert wallet_transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    type,
    amount,
    reference_type,
    reference_id,
    description
  ) VALUES (
    v_wallet_id,
    'credit',
    v_payment.amount,
    'payment',
    p_payment_id,
    'Payment credited to company wallet'
  );

  -- 7) Return success
  RETURN jsonb_build_object(
    'ok', true,
    'wallet_id', v_wallet_id,
    'amount', v_payment.amount,
    'new_balance', v_new_balance
  );
END;
$$;
