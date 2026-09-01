CREATE TABLE IF NOT EXISTS project_access_emails (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_project_access_email"
  ON project_access_emails (project_id, email);

CREATE INDEX IF NOT EXISTS "IDX_project_access_email"
  ON project_access_emails (email);