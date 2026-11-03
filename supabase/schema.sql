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

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,                 -- sha-256 hash of the shared secret
  name text not null,
  size bigint not null default 0,
  path text not null,                      -- object path in the 'files' bucket
  created_at timestamptz not null default now()
);

create index if not exists files_workspace_idx on public.files (workspace);

alter table public.files enable row level security;

drop policy if exists "anon full access" on public.files;
create policy "anon full access" on public.files
  for all using (true) with check (true);

alter publication supabase_realtime add table public.files;

-- Folders to organize files ------------------------------------------------

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  kind text not null default 'file',       -- 'file' | 'note'
  name text not null,
  created_at timestamptz not null default now()
);

-- if the table predates the kind column
alter table public.folders add column if not exists kind text not null default 'file';

create index if not exists folders_workspace_idx on public.folders (workspace);

alter table public.folders enable row level security;

drop policy if exists "anon full access" on public.folders;
create policy "anon full access" on public.folders
  for all using (true) with check (true);

alter publication supabase_realtime add table public.folders;

-- null folder_id = item lives at the workspace root. Deleting a folder moves
-- its items back to root (on delete set null), never orphans them.
alter table public.files
  add column if not exists folder_id uuid references public.folders(id) on delete set null;

alter table public.notes
  add column if not exists folder_id uuid references public.folders(id) on delete set null;

-- Storage bucket for the actual file bytes ----------------------------------

insert into storage.buckets (id, name, public)
values ('files', 'files', true)
on conflict (id) do nothing;

drop policy if exists "files bucket read" on storage.objects;
create policy "files bucket read" on storage.objects
  for select using (bucket_id = 'files');

drop policy if exists "files bucket insert" on storage.objects;
create policy "files bucket insert" on storage.objects
  for insert with check (bucket_id = 'files');

drop policy if exists "files bucket delete" on storage.objects;
create policy "files bucket delete" on storage.objects
  for delete using (bucket_id = 'files');

-- Repos: code folders pasted/dropped into the Repos tab --------------------
-- Metadata in `repos`, one row per file in `repo_files`. Text files up to 1MB
-- live inline in `content` (searchable via trigram index); binaries and larger
-- text go to the 'files' bucket under <workspace>/repos/<repo>/<sha256>.

create extension if not exists pg_trgm;

create table if not exists public.repos (
  id uuid primary key default gen_random_uuid(),
  workspace text not null,
  name text not null,
  file_count int not null default 0,
  dir_count int not null default 0,
  size bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace, name)
);

alter table public.repos enable row level security;

drop policy if exists "anon full access" on public.repos;
create policy "anon full access" on public.repos
  for all using (true) with check (true);

alter publication supabase_realtime add table public.repos;

create table if not exists public.repo_files (
  id uuid primary key default gen_random_uuid(),
  repo_id uuid not null references public.repos(id) on delete cascade,
  path text not null,                      -- repo-relative, '/'-separated
  size bigint not null,
  hash text not null,                      -- sha-256: re-imports skip unchanged files
  binary boolean not null default false,
  content text,                            -- null = bytes live in storage_path
  storage_path text,
  unique (repo_id, path)
);

create index if not exists repo_files_content_trgm on public.repo_files using gin (content gin_trgm_ops);

alter table public.repo_files enable row level security;

drop policy if exists "anon full access" on public.repo_files;
create policy "anon full access" on public.repo_files
  for all using (true) with check (true);

-- re-imports overwrite content-addressed blobs (upsert)
drop policy if exists "files bucket update" on storage.objects;
create policy "files bucket update" on storage.objects
  for update using (bucket_id = 'files');
