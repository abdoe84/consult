-- ============================================
-- Project Budget Table
-- ============================================
-- This patch adds budget structure tracking to projects
-- ============================================

CREATE TABLE IF NOT EXISTS project_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT,
  budgeted_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(15, 2) DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  status TEXT DEFAULT 'PLANNED',
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_budget_items_project_id ON project_budget_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_budget_items_category ON project_budget_items(category);
CREATE INDEX IF NOT EXISTS idx_project_budget_items_status ON project_budget_items(status);

COMMENT ON TABLE project_budget_items IS 'Project budget structure and tracking';
COMMENT ON COLUMN project_budget_items.category IS 'Budget category (e.g., LABOR, MATERIALS, EQUIPMENT, TRAVEL, SUBCONTRACTOR, OVERHEAD, OTHER)';
COMMENT ON COLUMN project_budget_items.subcategory IS 'Optional subcategory for detailed tracking';
COMMENT ON COLUMN project_budget_items.budgeted_amount IS 'Planned/budgeted amount';
COMMENT ON COLUMN project_budget_items.actual_amount IS 'Actual spent amount (calculated from expenses)';
COMMENT ON COLUMN project_budget_items.status IS 'Status: PLANNED, APPROVED, ACTIVE, CLOSED';
