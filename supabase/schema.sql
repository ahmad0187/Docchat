-- DocChat database schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists vector;

-- One row per uploaded PDF. workspace_id is the Supabase user id, or 'demo' for the public demo.
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null,
  name          text not null,
  pages         int  not null default 0,
  size_bytes    int  not null default 0,
  storage_path  text,
  status        text not null default 'processing',   -- processing | ready | failed
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists documents_workspace_idx on documents (workspace_id, created_at desc);

-- Text chunks with their embedding and page number.
create table if not exists chunks (
  id            bigint generated always as identity primary key,
  document_id   uuid not null references documents (id) on delete cascade,
  workspace_id  text not null,
  page_start    int  not null,
  page_end      int  not null,
  content       text not null,
  embedding     vector(1536) not null
);
create index if not exists chunks_workspace_idx on chunks (workspace_id);
create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

-- The app server uses the service-role key, which bypasses RLS. Enabling RLS with no policies
-- means the public anon key (used in the browser for login) can never read these tables directly.
alter table documents enable row level security;
alter table chunks    enable row level security;

-- Top-k most similar chunks inside one workspace only (this is the tenant isolation).
create or replace function match_chunks(p_workspace text, p_embedding vector(1536), p_k int default 5)
returns table (
  id bigint, document_id uuid, doc_name text, storage_path text,
  page_start int, page_end int, content text, similarity float
)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.document_id, d.name, d.storage_path, c.page_start, c.page_end, c.content,
         1 - (c.embedding <=> p_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  where c.workspace_id = p_workspace and d.status = 'ready'
  order by c.embedding <=> p_embedding
  limit p_k;
$$;

-- Only the server (service role) may call it.
revoke execute on function match_chunks(text, vector, int) from public, anon, authenticated;

-- Private bucket for the original PDFs (served to users through short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
