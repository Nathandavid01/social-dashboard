-- 0060 — Who last changed a client's editor/designer assignment.
--
-- Asignaciones shows "Lo cambió Eric · hace 5 minutos". Without these
-- columns the screen can say who IS assigned, but not who MADE the change.

alter table public.clients
  add column if not exists assignment_changed_by uuid
    references public.profiles(id) on delete set null;

alter table public.clients
  add column if not exists assignment_changed_at timestamptz;

comment on column public.clients.assignment_changed_by is
  'Profile that last changed assigned_to or assigned_designer.';
comment on column public.clients.assignment_changed_at is
  'When assigned_to or assigned_designer last changed.';

notify pgrst, 'reload schema';
