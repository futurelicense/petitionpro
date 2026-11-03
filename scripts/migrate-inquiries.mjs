import { loadServerModule } from './server-module.mjs';

const local = loadServerModule('src/lib/inquiries-local.ts');
const entries = local.listInquiries();
console.log(`${entries.length} local inquiries found. Local originals will be preserved.`);
if (!process.argv.includes('--apply')) {
  console.log('Dry run only. Apply the SQL migration, configure Supabase, then rerun with --apply.');
} else {
  const { supabaseConfig } = loadServerModule('src/lib/supabase.ts');
  const config = supabaseConfig();
  if (config.url !== 'https://cvlrhumxbyakxqzhenuw.supabase.co') throw new Error('The configured project is not the PetitionPro project provided for this migration.');
  const cloud = loadServerModule('src/lib/inquiries-supabase.ts');
  let migrated = 0;
  for (const entry of entries) {
    await cloud.importInquiry(local.readInquiry(entry.id), local.inquiryCv(entry.id));
    migrated++;
  }
  console.log(`${migrated} inquiries uploaded or already present. No email notifications were sent.`);
}
