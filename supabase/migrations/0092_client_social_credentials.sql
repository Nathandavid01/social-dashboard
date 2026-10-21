-- Eric 2026-10-20: «quiero que cada cliente tenga los usernames y passwords ...
-- de cada una de las páginas de redes sociales de los clientes».
-- Un acceso por red. La contraseña llega YA cifrada desde el servidor
-- (AES-256-GCM con CLIENT_CREDENTIALS_KEY); la base nunca ve el texto plano.
-- Solo owner y supervisor pueden leer o escribir (mismo corte que el RBAC
-- clients.credentials.read/edit).

create table if not exists public.client_social_credentials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','tiktok','youtube','linkedin','x','google','otra')),
  username text not null check (length(btrim(username)) > 0),
  password_encrypted text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null
);

create index if not exists client_social_credentials_client_idx
  on public.client_social_credentials (client_id);

alter table public.client_social_credentials enable row level security;

drop policy if exists "client_social_credentials: admins" on public.client_social_credentials;
create policy "client_social_credentials: admins"
  on public.client_social_credentials
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'supervisor'))
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'supervisor'))
  );

comment on table public.client_social_credentials is
  'Usuario y contraseña (cifrada AES-256-GCM en la app) de cada red social del cliente. Solo owner/supervisor.';

notify pgrst, 'reload schema';
