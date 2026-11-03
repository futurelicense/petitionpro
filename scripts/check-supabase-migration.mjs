import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = mkdtempSync(join(tmpdir(), 'petitionpro-sql-check-'));
const binaries = process.env.PG_BIN || '/usr/lib/postgresql/18/bin';
const database = join(directory, 'db');
let started = false;
const command = (name, args, input) => execFileSync(join(binaries, name), args, { input, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' });
const sql = input => command('psql', ['-h', directory, '-p', '55448', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], input);
try {
  command('initdb', ['-D', database, '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  command('pg_ctl', ['-D', database, '-l', join(directory, 'postgres.log'), '-o', `-k ${directory} -p 55448 -c listen_addresses=`, '-w', 'start']);
  started = true;
  sql(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id text primary key, bucket_id text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
    create policy existing_broad_policy on storage.objects for all to anon, authenticated using (true) with check (true);
  `);
  const migration = readFileSync(join(root, 'supabase/migrations/202611020001_petitionpro_inquiries.sql'), 'utf8');
  sql(migration); sql(migration);
  sql(`
    insert into storage.objects values ('private-cv', 'petitionpro-cvs'), ('other-file', 'another-bucket');
    set role service_role;
    insert into public.petitionpro_inquiries (id, created_at, fingerprint, cv_path, payload)
    values ('11111111-1111-4111-8111-111111111111', now(), repeat('a',64),
      '11111111-1111-4111-8111-111111111111/' || repeat('a',64) || '/cv',
      jsonb_build_object('id','11111111-1111-4111-8111-111111111111','fingerprint',repeat('a',64),'status','new','emailStatus','pending'));
    select * from public.petitionpro_patch_inquiry('11111111-1111-4111-8111-111111111111', '{"status":"reviewed"}');
    select * from public.petitionpro_patch_inquiry('11111111-1111-4111-8111-111111111111', '{"emailStatus":"accepted","emailId":"mail-test"}');
    do $$ begin
      if not exists(select 1 from public.petitionpro_inquiries where payload->>'status'='reviewed' and payload->>'emailStatus'='accepted') then raise exception 'Status merge lost data'; end if;
      begin
        perform public.petitionpro_patch_inquiry('11111111-1111-4111-8111-111111111111','{"report":"changed"}');
        raise exception 'Immutable patch was accepted';
      exception when invalid_parameter_value then null; end;
      begin
        perform public.petitionpro_patch_inquiry('11111111-1111-4111-8111-111111111111','{"status":null}');
        raise exception 'Null status was accepted';
      exception when check_violation then null; end;
    end $$;
    reset role;
  `);
  for (const role of ['anon', 'authenticated']) {
    sql(`set role ${role};
      do $$ begin
        if exists(select 1 from storage.objects where bucket_id='petitionpro-cvs') then raise exception 'Private CV exposed'; end if;
        if not exists(select 1 from storage.objects where bucket_id='another-bucket') then raise exception 'Unrelated bucket policy changed'; end if;
        begin perform 1 from public.petitionpro_inquiries; raise exception 'Inquiry table exposed'; exception when insufficient_privilege then null; end;
        begin perform public.petitionpro_patch_inquiry('11111111-1111-4111-8111-111111111111','{"status":"reviewed"}'); raise exception 'Inquiry function exposed'; exception when insufficient_privilege then null; end;
        begin insert into storage.objects values ('forbidden-${role}','petitionpro-cvs'); raise exception 'Private upload allowed'; exception when insufficient_privilege then null; end;
      end $$; reset role;`);
  }
  console.log('SQL migration passed: repeatable setup, atomic status merges, immutable field protection, and private inquiry/CV access. No remote project was modified.');
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  if (started) command('pg_ctl', ['-D', database, '-m', 'fast', '-w', 'stop']);
  rmSync(directory, { recursive: true, force: true });
}
