-- Client edit mode: AI pipeline vs human editor.
-- Default human. Full AI auto-dispatch is NOT built in this migration —
-- only the flag for staff to set per client.

alter table public.clients
  add column if not exists edit_mode text not null default 'human';

alter table public.clients
  drop constraint if exists clients_edit_mode_check;

alter table public.clients
  add constraint clients_edit_mode_check
  check (edit_mode in ('ai', 'human'));

comment on column public.clients.edit_mode is
  'ai = AI editing pipeline (flag only for now); human = editor humano. Default human.';
