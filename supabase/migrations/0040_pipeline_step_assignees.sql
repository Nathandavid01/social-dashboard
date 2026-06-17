-- Who owns each content-pipeline step (idea → publication). Configured in
-- /settings/workflow; shown on planned cards and used as the default owner hint.
alter table public.workflow_settings
  add column if not exists pipeline_step_assignees jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
