-- Actionable checklist items: kind drives behavior (check | form | service | client_notify),
-- metadata stores structured field values / linked serviceId.
ALTER TABLE project_checklist_items
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'check',
  ADD COLUMN IF NOT EXISTS metadata JSONB;
