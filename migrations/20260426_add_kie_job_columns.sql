-- Add durable Kie image-edit job metadata.
-- Apply manually until this repo has a migration runner.

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS source_file_id varchar(64) REFERENCES files(id),
  ADD COLUMN IF NOT EXISTS result_file_id varchar(64) REFERENCES files(id),
  ADD COLUMN IF NOT EXISTS provider_task_id varchar(255);

CREATE INDEX IF NOT EXISTS jobs_provider_task_idx
  ON jobs (provider_name, provider_task_id);
