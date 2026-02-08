-- ============================================================
-- RPC: refund_full_for_payment
-- ============================================================
-- Called after provider refund succeeds.
-- Debits company wallet, inserts payment_refunds row.
-- Idempotent via idempotency_key.

CREATE OR REPLACE FUNCTION public.refund_full_for_payment(
  p_payment_id bigint,
  p_provider_refund_id text,
  p_idempotency_key text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_existing_refund RECORD;
  v_commission_rate numeric;
  v_refunded_sum numeric;
  v_amount_gross numeric;
  v_company_debit numeric;
  v_platform_fee_reversed numeric;
  v_wallet_id bigint;
  v_new_balance numeric;
  v_refund_id bigint;
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

  -- 3) Check idempotency: existing refund with same key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_refund
    FROM public.payment_refunds
    WHERE payment_id = p_payment_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      -- Already processed, return existing refund
      RETURN jsonb_build_object(
        'ok', true,
        'already_refunded', true,
        'refund_id', v_existing_refund.id,
        'amount_gross', v_existing_refund.amount_gross
      );
    END IF;
  END IF;

  -- 4) Check if already fully refunded
  SELECT COALESCE(SUM(amount_gross), 0) INTO v_refunded_sum
  FROM public.payment_refunds
  WHERE payment_id = p_payment_id
    AND status = 'succeeded';

  IF v_refunded_sum >= v_payment.amount THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'already_fully_refunded',
      'refunded_sum', v_refunded_sum,
      'payment_amount', v_payment.amount
    );
  END IF;

  -- 5) Calculate refund amounts
  v_commission_rate := get_commission_rate_for_payment(p_payment_id);
  v_amount_gross := v_payment.amount;
  v_platform_fee_reversed := v_amount_gross * v_commission_rate;
  v_company_debit := v_amount_gross - v_platform_fee_reversed;

  -- 6) Find company wallet
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE owner_type = 'company'
    AND owner_id = v_payment.company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'wallet_not_found'
    );
  END IF;

  -- 7) Check wallet balance (prevent negative)
  SELECT balance INTO v_new_balance
  FROM public.wallets
  WHERE id = v_wallet_id;

  IF v_new_balance < v_company_debit THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'insufficient_wallet_balance',
      'wallet_balance', v_new_balance,
      'required', v_company_debit
    );
  END IF;

  -- 8) Debit wallet (atomic)
  UPDATE public.wallets
  SET balance = balance - v_company_debit,
      updated_at = now()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_new_balance;

  -- 9) Insert wallet_transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    type,
    amount,
    reference_type,
    reference_id,
    description
  ) VALUES (
    v_wallet_id,
    'debit',
    v_company_debit,
    'refund',
    NULL, -- we'll update with refund_id after insert
    'Full refund: ' || COALESCE(p_reason, 'no reason')
  );

  -- 10) Insert payment_refunds row
  INSERT INTO public.payment_refunds (
    payment_id,
    refund_type,
    status,
    amount_gross,
    amount_company_debit,
    amount_platform_fee_reversed,
    commission_rate,
    currency,
    provider,
    provider_refund_id,
    idempotency_key,
    reason,
    processed_at
  )
  SELECT
    p_payment_id,
    'full',
    'succeeded',
    v_amount_gross,
    v_company_debit,
    v_platform_fee_reversed,
    v_commission_rate,
    v_payment.currency,
    v_payment.provider,
    p_provider_refund_id,
    p_idempotency_key,
    p_reason,
    now()
  FROM public.payments
  WHERE id = p_payment_id
  RETURNING id INTO v_refund_id;

  -- 11) Update wallet_transaction reference_id
  UPDATE public.wallet_transactions
  SET reference_id = v_refund_id
  WHERE wallet_id = v_wallet_id
    AND reference_type = 'refund'
    AND reference_id IS NULL
    AND created_at >= now() - interval '1 second';

  -- 12) Return success
  RETURN jsonb_build_object(
    'ok', true,
    'refund_id', v_refund_id,
    'amount_gross', v_amount_gross,
    'company_debit', v_company_debit,
    'platform_fee_reversed', v_platform_fee_reversed,
    'new_wallet_balance', v_new_balance
  );
END;
$$;
