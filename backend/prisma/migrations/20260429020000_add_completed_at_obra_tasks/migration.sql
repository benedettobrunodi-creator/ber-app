ALTER TABLE obra_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
UPDATE obra_tasks SET completed_at = updated_at WHERE status = 'done';
