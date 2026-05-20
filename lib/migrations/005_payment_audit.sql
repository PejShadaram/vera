-- Stripe event idempotency log
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     TEXT PRIMARY KEY,
  event_type   TEXT NOT NULL,
  received_at  TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Refund / dispute tracking on purchases
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS stripe_charge_id   TEXT,
  ADD COLUMN IF NOT EXISTS stripe_livemode    BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_test            BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS status             TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS refunded_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_amount_cents INTEGER;

-- Prevent double-claiming a single credit against multiple cases
CREATE UNIQUE INDEX IF NOT EXISTS purchases_one_unlock_per_case
  ON purchases (case_id)
  WHERE case_id IS NOT NULL AND tier = 'case_unlock';
