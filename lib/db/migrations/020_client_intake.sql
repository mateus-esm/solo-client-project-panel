CREATE TABLE IF NOT EXISTS client_intake_submissions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);