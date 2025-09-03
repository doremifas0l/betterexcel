-- Phase 3: Roles & Safe AI Migration
-- Create tables and add audit columns for multi-user collaboration

-- Create project_members table for role-based access control
CREATE TABLE IF NOT EXISTS project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'contributor', 'viewer')),
    invited_by UUID REFERENCES auth.users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

-- Create audit_logs table for tracking user actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_snapshots table for versioning
CREATE TABLE IF NOT EXISTS project_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    snapshot_name TEXT NOT NULL,
    note TEXT,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ai_rules table for AI-generated column rules
CREATE TABLE IF NOT EXISTS ai_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    column_id UUID REFERENCES columns(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('computed', 'validation', 'formatting')),
    rule_definition JSONB NOT NULL,
    natural_language_description TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add audit columns to existing tables if they don't exist

-- Projects table audit columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='created_by') THEN
        ALTER TABLE projects ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='updated_by') THEN
        ALTER TABLE projects ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Better_tables table audit columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='better_tables' AND column_name='created_by') THEN
        ALTER TABLE better_tables ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='better_tables' AND column_name='updated_by') THEN
        ALTER TABLE better_tables ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Better_sheets table audit columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='better_sheets' AND column_name='created_by') THEN
        ALTER TABLE better_sheets ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='better_sheets' AND column_name='updated_by') THEN
        ALTER TABLE better_sheets ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Columns table audit columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='columns' AND column_name='created_by') THEN
        ALTER TABLE columns ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='columns' AND column_name='updated_by') THEN
        ALTER TABLE columns ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Rows table audit columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rows' AND column_name='created_by') THEN
        ALTER TABLE rows ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rows' AND column_name='updated_by') THEN
        ALTER TABLE rows ADD COLUMN updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_user_project ON project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_project_snapshots_project ON project_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_rules_column ON ai_rules(column_id);
CREATE INDEX IF NOT EXISTS idx_ai_rules_active ON ai_rules(column_id, is_active) WHERE is_active = true;

-- Row Level Security (RLS) Policies

-- Enable RLS on new tables
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rules ENABLE ROW LEVEL SECURITY;

-- Project members policies
CREATE POLICY "Users can view project members for their projects" ON project_members
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p 
            WHERE p.user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM project_members pm 
                WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Project owners and admins can manage members" ON project_members
    FOR ALL USING (
        project_id IN (
            SELECT p.id FROM projects p 
            WHERE p.user_id = auth.uid()
        ) OR
        project_id IN (
            SELECT pm.project_id FROM project_members pm 
            WHERE pm.user_id = auth.uid() AND pm.role IN ('admin', 'owner')
        )
    );

-- Audit logs policies
CREATE POLICY "Users can view audit logs for their projects" ON audit_logs
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p 
            WHERE p.user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM project_members pm 
                WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "System can insert audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- Project snapshots policies
CREATE POLICY "Users can view snapshots for their projects" ON project_snapshots
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p 
            WHERE p.user_id = auth.uid() 
            OR EXISTS (
                SELECT 1 FROM project_members pm 
                WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Admins can create snapshots" ON project_snapshots
    FOR INSERT WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p 
            WHERE p.user_id = auth.uid()
        ) OR
        project_id IN (
            SELECT pm.project_id FROM project_members pm 
            WHERE pm.user_id = auth.uid() AND pm.role IN ('admin', 'owner')
        )
    );

-- AI rules policies
CREATE POLICY "Users can view AI rules for their project columns" ON ai_rules
    FOR SELECT USING (
        column_id IN (
            SELECT c.id FROM columns c
            JOIN better_sheets bs ON c.sheet_id = bs.id
            JOIN better_tables bt ON bs.table_id = bt.id
            WHERE bt.project_id IN (
                SELECT p.id FROM projects p 
                WHERE p.user_id = auth.uid() 
                OR EXISTS (
                    SELECT 1 FROM project_members pm 
                    WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Admins can manage AI rules" ON ai_rules
    FOR ALL USING (
        column_id IN (
            SELECT c.id FROM columns c
            JOIN better_sheets bs ON c.sheet_id = bs.id
            JOIN better_tables bt ON bs.table_id = bt.id
            WHERE bt.project_id IN (
                SELECT p.id FROM projects p 
                WHERE p.user_id = auth.uid()
            ) OR bt.project_id IN (
                SELECT pm.project_id FROM project_members pm 
                WHERE pm.user_id = auth.uid() AND pm.role IN ('admin', 'owner')
            )
        )
    );

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_rules_updated_at
    BEFORE UPDATE ON ai_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set up audit trail for key tables
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Get project_id based on the table being modified
    DECLARE
        proj_id UUID;
        action_type TEXT;
        target_type TEXT;
        target_id UUID;
    BEGIN
        -- Determine action type
        IF TG_OP = 'INSERT' THEN
            action_type := lower(TG_TABLE_NAME) || '_created';
            target_id := NEW.id;
        ELSIF TG_OP = 'UPDATE' THEN
            action_type := lower(TG_TABLE_NAME) || '_updated';
            target_id := NEW.id;
        ELSIF TG_OP = 'DELETE' THEN
            action_type := lower(TG_TABLE_NAME) || '_deleted';
            target_id := OLD.id;
        END IF;

        target_type := lower(TG_TABLE_NAME);

        -- Get project_id based on table structure
        IF TG_TABLE_NAME = 'projects' THEN
            proj_id := COALESCE(NEW.id, OLD.id);
        ELSIF TG_TABLE_NAME = 'better_tables' THEN
            proj_id := COALESCE(NEW.project_id, OLD.project_id);
        ELSIF TG_TABLE_NAME = 'better_sheets' THEN
            SELECT bt.project_id INTO proj_id
            FROM better_tables bt
            WHERE bt.id = COALESCE(NEW.table_id, OLD.table_id);
        ELSIF TG_TABLE_NAME = 'columns' THEN
            SELECT bt.project_id INTO proj_id
            FROM better_tables bt
            JOIN better_sheets bs ON bt.id = bs.table_id
            WHERE bs.id = COALESCE(NEW.sheet_id, OLD.sheet_id);
        ELSIF TG_TABLE_NAME = 'rows' THEN
            SELECT bt.project_id INTO proj_id
            FROM better_tables bt
            JOIN better_sheets bs ON bt.id = bs.table_id
            WHERE bs.id = COALESCE(NEW.sheet_id, OLD.sheet_id);
        END IF;

        -- Insert audit log
        IF proj_id IS NOT NULL THEN
            INSERT INTO audit_logs (project_id, user_id, action_type, target_type, target_id, details)
            VALUES (
                proj_id,
                auth.uid(),
                action_type,
                target_type,
                target_id,
                jsonb_build_object(
                    'table', TG_TABLE_NAME,
                    'operation', TG_OP,
                    'timestamp', NOW()
                )
            );
        END IF;

        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
DROP TRIGGER IF EXISTS audit_projects_changes ON projects;
CREATE TRIGGER audit_projects_changes
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_better_tables_changes ON better_tables;
CREATE TRIGGER audit_better_tables_changes
    AFTER INSERT OR UPDATE OR DELETE ON better_tables
    FOR EACH ROW
    EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_better_sheets_changes ON better_sheets;
CREATE TRIGGER audit_better_sheets_changes
    AFTER INSERT OR UPDATE OR DELETE ON better_sheets
    FOR EACH ROW
    EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_columns_changes ON columns;
CREATE TRIGGER audit_columns_changes
    AFTER INSERT OR UPDATE OR DELETE ON columns
    FOR EACH ROW
    EXECUTE FUNCTION log_table_changes();

DROP TRIGGER IF EXISTS audit_rows_changes ON rows;
CREATE TRIGGER audit_rows_changes
    AFTER INSERT OR UPDATE OR DELETE ON rows
    FOR EACH ROW
    EXECUTE FUNCTION log_table_changes();

-- Create helper function to get user role in project
CREATE OR REPLACE FUNCTION get_user_role_in_project(user_uuid UUID, project_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Check if user is project owner
    SELECT 'owner' INTO user_role
    FROM projects p
    WHERE p.id = project_uuid AND p.user_id = user_uuid;
    
    IF user_role IS NOT NULL THEN
        RETURN user_role;
    END IF;
    
    -- Check project members table
    SELECT pm.role INTO user_role
    FROM project_members pm
    WHERE pm.project_id = project_uuid AND pm.user_id = user_uuid;
    
    RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql;

-- Create function to check if user has required permission level
CREATE OR REPLACE FUNCTION user_has_permission(
    user_uuid UUID, 
    project_uuid UUID, 
    required_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_level INT;
    required_level INT;
BEGIN
    -- Get user role
    user_role := get_user_role_in_project(user_uuid, project_uuid);
    
    -- Map roles to levels
    user_level := CASE user_role
        WHEN 'owner' THEN 5
        WHEN 'admin' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'contributor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    -- Map permissions to required levels
    required_level := CASE required_permission
        WHEN 'view' THEN 1
        WHEN 'edit_data' THEN 2
        WHEN 'ai_fill' THEN 2
        WHEN 'edit_structure' THEN 4
        WHEN 'manage_members' THEN 4
        WHEN 'create_snapshots' THEN 4
        WHEN 'restore_snapshots' THEN 4
        WHEN 'ai_rules' THEN 4
        WHEN 'transfer_ownership' THEN 5
        WHEN 'delete_project' THEN 5
        ELSE 999
    END;
    
    RETURN user_level >= required_level;
END;
$$ LANGUAGE plpgsql;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON project_members TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT ON project_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_rules TO authenticated;

GRANT USAGE ON SEQUENCE project_members_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE audit_logs_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE project_snapshots_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE ai_rules_id_seq TO authenticated;
