-- ============================================
-- Partners Procurement Table Fix
-- ============================================
-- This patch ensures the project_partner_procurement table
-- has all required fields for proper functionality
-- ============================================

-- Ensure the table exists with all required fields
CREATE TABLE IF NOT EXISTS project_partner_procurement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES project_partners(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  sap_ref TEXT NOT NULL,
  status TEXT DEFAULT 'OPEN',
  start_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add start_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_partner_procurement'
    AND column_name = 'start_date'
  ) THEN
    ALTER TABLE project_partner_procurement ADD COLUMN start_date DATE;
  END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_partner_procurement'
    AND column_name = 'notes'
  ) THEN
    ALTER TABLE project_partner_procurement ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_project_partner_procurement_partner_id
  ON project_partner_procurement(partner_id);
CREATE INDEX IF NOT EXISTS idx_project_partner_procurement_status
  ON project_partner_procurement(status);
CREATE INDEX IF NOT EXISTS idx_project_partner_procurement_doc_type
  ON project_partner_procurement(doc_type);
CREATE INDEX IF NOT EXISTS idx_project_partner_procurement_start_date
  ON project_partner_procurement(start_date);

-- Add comments for documentation
COMMENT ON TABLE project_partner_procurement IS 'PR/PO/SEC documents for project partners';
COMMENT ON COLUMN project_partner_procurement.doc_type IS 'Document type: PR (Purchase Request), PO (Purchase Order), or SEC (Service Entry Sheet)';
COMMENT ON COLUMN project_partner_procurement.sap_ref IS 'SAP system reference number';
COMMENT ON COLUMN project_partner_procurement.status IS 'Status: OPEN, IN_PROGRESS, COMPLETED, CLOSED, CANCELLED';
COMMENT ON COLUMN project_partner_procurement.start_date IS 'Start date of the procurement process';
COMMENT ON COLUMN project_partner_procurement.notes IS 'Optional notes about the procurement item';
