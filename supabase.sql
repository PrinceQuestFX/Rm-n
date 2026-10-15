-- À coller dans Supabase > SQL Editor > Run
create table if not exists userdata(
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table userdata enable row level security;
create policy "mes donnees" on userdata for all
  using (auth.uid()=user_id) with check (auth.uid()=user_id);

insert into storage.buckets(id,name,public) values('pdfs','pdfs',false) on conflict do nothing;
create policy "mes pdf" on storage.objects for all
  using (bucket_id='pdfs' and (storage.foldername(name))[1]=auth.uid()::text)
  with check (bucket_id='pdfs' and (storage.foldername(name))[1]=auth.uid()::text);
