-- PetitionPro: server-only inquiry records and private CV attachments.
-- Apply to project cvlrhumxbyakxqzhenuw through the Supabase SQL Editor or CLI.
begin;

create table if not exists public.petitionpro_inquiries (
  id uuid primary key,
  created_at timestamptz not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  cv_path text not null unique,
  constraint petitionpro_cv_path check (cv_path = id::text || '/' || fingerprint || '/cv'),
  payload jsonb not null,
  constraint petitionpro_inquiry_object check (jsonb_typeof(payload) = 'object'),
  constraint petitionpro_inquiry_id check (payload->>'id' is not null and payload->>'id' = id::text),
  constraint petitionpro_inquiry_fingerprint check (payload->>'fingerprint' is not null and payload->>'fingerprint' = fingerprint),
  constraint petitionpro_inquiry_status check (payload->>'status' is not null and payload->>'status' in ('new','reviewed','converted')),
  constraint petitionpro_inquiry_email_status check (payload->>'emailStatus' is not null and payload->>'emailStatus' in ('pending','not-configured','failed','accepted'))
);
create index if not exists petitionpro_inquiries_created_at_idx on public.petitionpro_inquiries (created_at desc, id desc);
alter table public.petitionpro_inquiries enable row level security;
revoke all on public.petitionpro_inquiries from public, anon, authenticated;
grant select, insert, update, delete on public.petitionpro_inquiries to service_role;

-- Merge only mutable status fields inside Postgres so a mail retry cannot
-- overwrite a concurrent admin review or case-conversion update.
create or replace function public.petitionpro_patch_inquiry(p_id uuid, p_patch jsonb)
returns setof public.petitionpro_inquiries
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or (p_patch - array['status','emailStatus','emailId']) <> '{}'::jsonb then
    raise exception 'Invalid inquiry patch' using errcode = '22023';
  end if;
  return query update public.petitionpro_inquiries
    set payload = payload || p_patch
    where id = p_id returning *;
end;
$$;
revoke all on function public.petitionpro_patch_inquiry(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.petitionpro_patch_inquiry(uuid,jsonb) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('petitionpro-cvs', 'petitionpro-cvs', false, 6291456,
  array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','text/markdown'])
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from storage.buckets where id = 'petitionpro-cvs' and public) then
    raise exception 'The petitionpro-cvs bucket already exists as public. Make it private before applying this migration.';
  end if;
end;
$$;

-- A restrictive policy protects this bucket even if the project already has
-- broad permissive policies for other Storage buckets. The server key bypasses RLS.
drop policy if exists petitionpro_private_cvs on storage.objects;
create policy petitionpro_private_cvs on storage.objects as restrictive
  for all to anon, authenticated
  using (bucket_id <> 'petitionpro-cvs')
  with check (bucket_id <> 'petitionpro-cvs');

notify pgrst, 'reload schema';
commit;
