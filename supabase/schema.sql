create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,                 -- sha-256 hash of the shared secret
  title text not null default 'Untitled',
  content text not null default '',
  mode text not null default 'text',       -- 'text' | 'code'
  language text not null default 'plaintext',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_workspace_idx on public.notes (workspace);

alter table public.notes enable row level security;

drop policy if exists "anon full access" on public.notes;
create policy "anon full access" on public.notes
  for all using (true) with check (true);

alter publication supabase_realtime add table public.notes;
