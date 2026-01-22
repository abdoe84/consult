-- ============================================
-- Project Expenses Table
-- ============================================
-- This patch adds expense tracking to projects
-- ============================================

CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'SAR',
  expense_date DATE DEFAULT CURRENT_DATE,
  vendor TEXT,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project_id ON project_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_project_expenses_category ON project_expenses(category);
CREATE INDEX IF NOT EXISTS idx_project_expenses_expense_date ON project_expenses(expense_date);

COMMENT ON TABLE project_expenses IS 'Project expenses/costs tracking';
COMMENT ON COLUMN project_expenses.category IS 'Expense category (e.g., LABOR, MATERIALS, EQUIPMENT, TRAVEL, OTHER)';
COMMENT ON COLUMN project_expenses.amount IS 'Expense amount in specified currency';
COMMENT ON COLUMN project_expenses.currency IS 'Currency code (SAR, USD, etc.)';
