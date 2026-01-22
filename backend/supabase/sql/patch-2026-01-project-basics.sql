-- Patch: Project Basics Enhancement
-- Date: 2026-01
-- Description: Add value_sar field to projects, ensure role_in_project default

-- 1. Add value_sar column to projects table (nullable numeric)
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

-- 2. Ensure project_team.role_in_project has default 'MEMBER'
DO $$
BEGIN
  -- Check if default exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_team'
    AND column_name = 'role_in_project'
    AND column_default IS NOT NULL
  ) THEN
    -- Set default if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'project_team' AND column_name = 'role_in_project'
    ) THEN
      ALTER TABLE project_team
      ALTER COLUMN role_in_project SET DEFAULT 'MEMBER';
    END IF;
  END IF;
END $$;

-- 3. Update existing NULL role_in_project to 'MEMBER' (idempotent)
UPDATE project_team
SET role_in_project = 'MEMBER'
WHERE role_in_project IS NULL;

-- 4. Ensure projects.name and projects.title are both handled
-- (No schema change needed, application handles both)
