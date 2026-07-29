-- Un cliente tiene un editor y un diseñador, y no son la misma persona.
-- `assigned_to` ya existía y pasa a significar EDITOR; el diseñador necesita
-- su propia columna. Reusar la misma para ambos obligaría a elegir uno.

alter table public.clients
  add column if not exists assigned_designer uuid references public.profiles(id) on delete set null;

create index if not exists idx_clients_assigned_designer on public.clients(assigned_designer);
