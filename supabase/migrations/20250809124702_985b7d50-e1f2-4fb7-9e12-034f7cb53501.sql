-- Enable required extensions
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Enums
do $$ begin
  if not exists (select 1 from pg_type where typname = 'vault_role') then
    create type public.vault_role as enum ('OWNER','EDITOR','VIEWER');
  end if;
  if not exists (select 1 from pg_type where typname = 'note_status') then
    create type public.note_status as enum ('ACTIVE','MERGED','ARCHIVED');
  end if;
  if not exists (select 1 from pg_type where typname = 'rule_type') then
    create type public.rule_type as enum ('CALENDAR','LOCATION','KEYWORD','CONTACT');
  end if;
end $$;

-- Tables
create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  feature_flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_members (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.vault_role not null default 'EDITOR',
  created_at timestamptz not null default now(),
  unique(vault_id, user_id)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content jsonb not null,
  embeddings vector(1536),
  tags text[] not null default '{}',
  entities jsonb,
  summary text,
  status public.note_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proactive_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.rule_type not null,
  config jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proactive_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.proactive_rules(id) on delete set null,
  trigger_at timestamptz not null,
  signal jsonb not null,
  candidates jsonb,
  sent_at timestamptz,
  opened_at timestamptz,
  action_taken jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_vault_members_vault on public.vault_members(vault_id);
create index if not exists idx_vault_members_user on public.vault_members(user_id);
create index if not exists idx_notes_vault on public.notes(vault_id);
create index if not exists idx_notes_author on public.notes(author_id);
create index if not exists idx_notes_tags on public.notes using gin(tags);
create index if not exists idx_notes_entities on public.notes using gin(entities);
-- Vector index (requires pgvector)
create index if not exists idx_notes_embeddings on public.notes using ivfflat (embeddings vector_cosine_ops) with (lists = 100);

create index if not exists idx_proactive_rules_user on public.proactive_rules(user_id);
create index if not exists idx_proactive_events_user on public.proactive_events(user_id);
create index if not exists idx_proactive_events_trigger_at on public.proactive_events(trigger_at);

-- RLS
alter table public.vaults enable row level security;
alter table public.vault_members enable row level security;
alter table public.notes enable row level security;
alter table public.proactive_rules enable row level security;
alter table public.proactive_events enable row level security;

-- Policies for vaults
create policy if not exists "vaults_select_member_or_owner"
  on public.vaults for select
  using (
    owner_id = auth.uid() or
    exists (
      select 1 from public.vault_members vm
      where vm.vault_id = vaults.id and vm.user_id = auth.uid()
    )
  );

create policy if not exists "vaults_insert_owner"
  on public.vaults for insert
  with check ( owner_id = auth.uid() );

create policy if not exists "vaults_update_owner_only"
  on public.vaults for update
  using ( owner_id = auth.uid() );

create policy if not exists "vaults_delete_owner_only"
  on public.vaults for delete
  using ( owner_id = auth.uid() );

-- Policies for vault_members
create policy if not exists "vault_members_select_for_members"
  on public.vault_members for select
  using (
    exists (
      select 1 from public.vault_members vm2
      where vm2.vault_id = vault_members.vault_id and vm2.user_id = auth.uid()
    ) or exists (
      select 1 from public.vaults v where v.id = vault_members.vault_id and v.owner_id = auth.uid()
    )
  );

create policy if not exists "vault_members_insert_owner_only"
  on public.vault_members for insert
  with check (
    exists (
      select 1 from public.vaults v where v.id = vault_members.vault_id and v.owner_id = auth.uid()
    )
  );

create policy if not exists "vault_members_update_owner_only"
  on public.vault_members for update
  using (
    exists (
      select 1 from public.vaults v where v.id = vault_members.vault_id and v.owner_id = auth.uid()
    )
  );

create policy if not exists "vault_members_delete_owner_or_self"
  on public.vault_members for delete
  using (
    user_id = auth.uid() or exists (
      select 1 from public.vaults v where v.id = vault_members.vault_id and v.owner_id = auth.uid()
    )
  );

-- Policies for notes
create policy if not exists "notes_select_vault_members"
  on public.notes for select
  using (
    exists (
      select 1 from public.vault_members vm where vm.vault_id = notes.vault_id and vm.user_id = auth.uid()
    ) or exists (
      select 1 from public.vaults v where v.id = notes.vault_id and v.owner_id = auth.uid()
    )
  );

create policy if not exists "notes_insert_editors_and_owner"
  on public.notes for insert
  with check (
    author_id = auth.uid() and (
      exists (
        select 1 from public.vault_members vm
        where vm.vault_id = notes.vault_id and vm.user_id = auth.uid() and vm.role in ('OWNER','EDITOR')
      ) or exists (
        select 1 from public.vaults v where v.id = notes.vault_id and v.owner_id = auth.uid()
      )
    )
  );

create policy if not exists "notes_update_editors_and_owner"
  on public.notes for update
  using (
    exists (
      select 1 from public.vault_members vm
      where vm.vault_id = notes.vault_id and vm.user_id = auth.uid() and vm.role in ('OWNER','EDITOR')
    ) or exists (
      select 1 from public.vaults v where v.id = notes.vault_id and v.owner_id = auth.uid()
    )
  );

create policy if not exists "notes_delete_owner_or_author"
  on public.notes for delete
  using (
    author_id = auth.uid() or exists (
      select 1 from public.vaults v where v.id = notes.vault_id and v.owner_id = auth.uid()
    )
  );

-- Policies for proactive_rules
create policy if not exists "proactive_rules_select_own"
  on public.proactive_rules for select
  using ( user_id = auth.uid() );

create policy if not exists "proactive_rules_insert_own"
  on public.proactive_rules for insert
  with check ( user_id = auth.uid() );

create policy if not exists "proactive_rules_update_own"
  on public.proactive_rules for update
  using ( user_id = auth.uid() );

create policy if not exists "proactive_rules_delete_own"
  on public.proactive_rules for delete
  using ( user_id = auth.uid() );

-- Policies for proactive_events
create policy if not exists "proactive_events_select_own"
  on public.proactive_events for select
  using ( user_id = auth.uid() );

create policy if not exists "proactive_events_insert_own"
  on public.proactive_events for insert
  with check ( user_id = auth.uid() );

create policy if not exists "proactive_events_update_own"
  on public.proactive_events for update
  using ( user_id = auth.uid() );

create policy if not exists "proactive_events_delete_own"
  on public.proactive_events for delete
  using ( user_id = auth.uid() );

-- updated_at triggers
-- assumes public.update_updated_at_column() exists
create trigger if not exists trg_vaults_updated
before update on public.vaults
for each row execute function public.update_updated_at_column();

create trigger if not exists trg_notes_updated
before update on public.notes
for each row execute function public.update_updated_at_column();

create trigger if not exists trg_proactive_rules_updated
before update on public.proactive_rules
for each row execute function public.update_updated_at_column();

create trigger if not exists trg_proactive_events_updated
before update on public.proactive_events
for each row execute function public.update_updated_at_column();
