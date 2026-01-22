-- ============================================
-- Add reject_reason column to service_requests table
-- ============================================
-- This migration adds the reject_reason column if it doesn't exist
-- ============================================

DO $$
BEGIN
  -- Check if reject_reason column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'service_requests'
      AND column_name = 'reject_reason'
  ) THEN
    -- Add reject_reason column
    ALTER TABLE service_requests
    ADD COLUMN reject_reason TEXT;

    COMMENT ON COLUMN service_requests.reject_reason IS 'Reason for rejection when status is CONSULTANT_REJECTED';

    RAISE NOTICE 'Column reject_reason added to service_requests table';
  ELSE
    RAISE NOTICE 'Column reject_reason already exists in service_requests table';
  END IF;
END $$;
