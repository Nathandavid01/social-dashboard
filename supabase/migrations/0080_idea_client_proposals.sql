-- Client approval of immutable idea proposals. Separate from video approval/publication.
create table public.idea_client_proposals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.recording_sessions(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  client_name text not null,
  session_date date not null,
  token_hash text not null unique,
  ideas jsonb not null check (jsonb_typeof(ideas) = 'array' and jsonb_array_length(ideas) > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index idea_client_proposals_session_idx on public.idea_client_proposals(session_id, created_at desc);
create table public.idea_client_responses (
  proposal_id uuid not null references public.idea_client_proposals(id) on delete cascade,
  idea_id uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  comment text not null default '' check (length(comment) <= 3000),
  responded_at timestamptz not null default now(),
  primary key (proposal_id, idea_id)
);
-- Only capability-validated server code may use these tables. No anon/authenticated policies.
alter table public.idea_client_proposals enable row level security;
alter table public.idea_client_responses enable row level security;
revoke all on public.idea_client_proposals, public.idea_client_responses from anon, authenticated;
grant all on public.idea_client_proposals, public.idea_client_responses to service_role;
notify pgrst, 'reload schema';
