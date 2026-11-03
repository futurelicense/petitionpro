import { loadServerModule } from './server-module.mjs';

const { supabaseConfig, supabaseFetch } = loadServerModule('src/lib/supabase.ts');
const { url } = supabaseConfig();
if (url !== 'https://cvlrhumxbyakxqzhenuw.supabase.co') throw new Error('Configured Supabase origin does not match the supplied PetitionPro project.');
await supabaseFetch('/rest/v1/petitionpro_inquiries?select=id&limit=0');
await supabaseFetch('/rest/v1/rpc/petitionpro_patch_inquiry', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_id: null, p_patch: {} }),
});
const response = await supabaseFetch('/storage/v1/bucket/petitionpro-cvs');
const bucket = await response.json();
if (bucket.public !== false) throw new Error('The CV bucket must be private.');
if (bucket.file_size_limit !== null && Number(bucket.file_size_limit) < 6 * 1024 * 1024) throw new Error('The CV bucket must allow uploads up to 6 MB.');
console.log('Supabase connection verified: inquiry table, atomic status updates, and private CV bucket. No client data was read or uploaded.');
