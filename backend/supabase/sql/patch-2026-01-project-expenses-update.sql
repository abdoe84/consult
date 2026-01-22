-- ============================================
-- Project Expenses Table Update
-- ============================================
-- This patch adds subcategory and status fields to match budget structure
-- ============================================

-- Add subcategory column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses'
    AND column_name = 'subcategory'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN subcategory TEXT;
  END IF;
END $$;

-- Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_expenses'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE project_expenses ADD COLUMN status TEXT DEFAULT 'PENDING';
  END IF;
END $$;

-- Create index on status if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_project_expenses_status ON project_expenses(status);
CREATE INDEX IF NOT EXISTS idx_project_expenses_subcategory ON project_expenses(subcategory);

-- Update comments
COMMENT ON COLUMN project_expenses.subcategory IS 'Optional subcategory for detailed expense tracking (matches budget structure)';
COMMENT ON COLUMN project_expenses.status IS 'Expense status: PENDING, APPROVED, PAID, REJECTED';
COMMENT ON COLUMN project_expenses.category IS 'Expense category (e.g., LABOR, MATERIALS, EQUIPMENT, TRAVEL, SUBCONTRACTOR, OVERHEAD, OTHER) - matches budget categories';
