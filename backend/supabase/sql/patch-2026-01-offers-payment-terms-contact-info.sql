-- ============================================
-- Add payment_terms and contact_info columns to offers table
-- ============================================
-- This migration adds JSON columns for payment terms and contact info
-- These are optional fields that enhance the client portal experience
-- ============================================

DO $$
BEGIN
  -- Add payment_terms column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offers'
      AND column_name = 'payment_terms'
  ) THEN
    ALTER TABLE offers
    ADD COLUMN payment_terms JSONB;

    COMMENT ON COLUMN offers.payment_terms IS 'Payment schedule, methods, and bank details for client portal';
    RAISE NOTICE 'Column payment_terms added to offers table';
  ELSE
    RAISE NOTICE 'Column payment_terms already exists in offers table';
  END IF;

  -- Add contact_info column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offers'
      AND column_name = 'contact_info'
  ) THEN
    ALTER TABLE offers
    ADD COLUMN contact_info JSONB;

    COMMENT ON COLUMN offers.contact_info IS 'Account manager and company contact information for client portal';
    RAISE NOTICE 'Column contact_info added to offers table';
  ELSE
    RAISE NOTICE 'Column contact_info already exists in offers table';
  END IF;
END $$;
