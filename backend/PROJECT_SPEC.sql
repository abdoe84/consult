-- ============================================
-- REVIVA ERP Lite - Project Execution Schema
-- ============================================
-- This SQL file creates/alters all tables needed for the Project Execution module
-- Uses IF NOT EXISTS for safe idempotent execution
-- ============================================

-- ============================================
-- 1. Projects table (ensure value_sar exists)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'value_sar'
  ) THEN
    ALTER TABLE projects ADD COLUMN value_sar NUMERIC(15, 2);
    COMMENT ON COLUMN projects.value_sar IS 'Project value in SAR (nullable)';
  END IF;
END $$;

-- ============================================
-- 2. Project Team
-- ============================================
CREATE TABLE IF NOT EXISTS project_team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role_in_project TEXT NOT NULL DEFAULT 'MEMBER',
  member_role TEXT,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  added_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_team_project_id ON project_team(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_user_id ON project_team(user_id);

-- ============================================
-- 3. Project Milestones
-- ============================================
CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'PLANNED',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_start_date ON project_milestones(start_date);

-- ============================================
-- 4. Project Tasks
-- ============================================
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES project_milestones(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'TODO',
  priority TEXT DEFAULT 'NORMAL',
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  actual_days INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_milestone_id ON project_tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);

-- ============================================
-- 5. Documents (if not exists, ensure structure)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  uploaded_by_user_id UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by_user_id);

-- ============================================
-- 6. Project Documents (linking table)
-- ============================================
CREATE TABLE IF NOT EXISTS project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  entity_type TEXT DEFAULT 'PROJECT',
  entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, document_id)
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_document_id ON project_documents(document_id);

-- ============================================
-- 7. Project Invoices
-- ============================================
CREATE TABLE IF NOT EXISTS project_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_no TEXT,
  partner_id UUID,
  description TEXT,
  currency TEXT DEFAULT 'SAR',
  amount NUMERIC(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'DRAFT',
  issued_at DATE,
  due_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_invoices_project_id ON project_invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invoices_status ON project_invoices(status);

-- ============================================
-- 8. Project Payments
-- ============================================
CREATE TABLE IF NOT EXISTS project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES project_invoices(id) ON DELETE SET NULL,
  currency TEXT DEFAULT 'SAR',
  amount NUMERIC(15, 2) DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  method TEXT,
  reference TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_invoice_id ON project_payments(invoice_id);

-- ============================================
-- 9. Project Partners
-- ============================================
CREATE TABLE IF NOT EXISTS project_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  partner_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'ACTIVE',
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_partners_project_id ON project_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_type ON project_partners(partner_type);

-- ============================================
-- 10. Project Partner Procurement
-- ============================================
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

CREATE INDEX IF NOT EXISTS idx_project_partner_procurement_partner_id ON project_partner_procurement(partner_id);
CREATE INDEX IF NOT EXISTS idx_project_partner_procurement_status ON project_partner_procurement(status);

-- ============================================
-- RLS Policies (if using RLS)
-- ============================================
-- Note: Adjust policies based on your security requirements
-- These are basic examples - customize as needed

-- Enable RLS on tables (if needed)
-- ALTER TABLE project_team ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;
-- ... (repeat for other tables)

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE project_team IS 'Team members assigned to projects';
COMMENT ON TABLE project_milestones IS 'Project milestones/targets';
COMMENT ON TABLE project_tasks IS 'Project tasks with optional milestone linkage';
COMMENT ON TABLE project_documents IS 'Links documents to projects';
COMMENT ON TABLE project_invoices IS 'Project invoices';
COMMENT ON TABLE project_payments IS 'Project payments';
COMMENT ON TABLE project_partners IS 'External partners (LAB, SUBCONTRACTOR)';
COMMENT ON TABLE project_partner_procurement IS 'PR/PO/SEC documents for partners';
