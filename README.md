# PetitionPro

Next.js drafting studio and browser-local case room for EB-2 NIW and EB-1A work.

## Run

Install dependencies with `npm install`, copy `.env.example` to `.env.local`, and set:

- `GROQ_API_KEY` for AI requests.
- `ADMIN_USER` and `ADMIN_PASSWORD` for admin sign-in.
- `ADMIN_SESSION_SECRET` to a random secret of at least 32 characters. Generate one with `openssl rand -hex 32`.

Admin sign-in has no fallback credentials or secret. Missing configuration returns a 503 at login. Existing cookies from the previous session implementation are invalid.

Run `npm run dev` and open `http://localhost:3040`.

## Sessions and storage

Admin sessions are random tokens with a server-enforced 12-hour lifetime. Logout deletes the corresponding server-side session; changing the admin password, username, or session secret invalidates existing sessions.

Session records contain a token hash, expiry, and credential fingerprint, not passwords or raw tokens. They are stored as individual files in `.data/admin-sessions` by default. Set `ADMIN_SESSION_DIR` to a private, writable persistent directory for production. All application instances must share that directory if running multiple instances. Ephemeral filesystems invalidate sessions when files disappear; read-only filesystems cannot issue sessions.

Cases, CV text, idea-bank notes, and requests remain in browser local storage.

In the case room, choosing a new CV clears the previous text and quote checks. Text files are read directly; after selecting a PDF or DOCX, paste its text before checking quotes. The studio's separate CV upload workflow extracts PDF and DOCX text on the server.

## Validation

- `npm test` runs regression checks without AI or GitHub requests.
- `npm run lint` checks source and tests.
- `npx next typegen` followed by `npx tsc --noEmit --incremental false` checks types.
- `npm run build` creates the production build.

## Case cost intake

Each well-positioning milestone has a USD expense intake: estimated cost, actual cost, paid to date, responsible person, payee, latest payment date, invoice or receipt reference, and notes. Use **Save cost** to persist an entry. Positive payments require a payee and payment date. Blank amounts remain unknown; zero explicitly means no charge.

Every case shows expense totals across all its milestones, including shared milestones only once and costs on items later left out. Outstanding balances are calculated per milestone; advances on another milestone do not offset them. Closed periods lock cost editing and preserve cost totals in the period summary. These expense records are stored with the case in this browser, independently of evidence completion.

## Free assessment and consultant inquiries

`/` is the public EB-2 NIW assessment. Users generate an endeavor, upload or paste a CV, and generate drafts without signing in. `/diy` provides a browser-local evidence checklist based on the result. The dual-track admin studio moved to `/studio`; all case, project, idea-bank, request, inquiry-inbox, and admin API routes remain authenticated.

Submitting a consultant inquiry requires contact details and explicit consent to share the endeavor, assessment, and CV. When Supabase is configured, inquiry records are stored in Postgres and original CVs in a private Supabase Storage bucket. Local development without Supabase configuration uses `.data/inquiries` (override with `INQUIRY_STORAGE_DIR`). When the input was a pasted CV, a text copy is attached. After a page reload, users reattach an originally uploaded file before submitting. Only admins can list inquiries or download CVs.

Admin Overview shows a new-inquiry notice and `/inquiries` provides review, CV download, case import, and email retry. Case import uses a stable inquiry ID and preserves any existing case work. Inquiries are shared through the server; imported case workflows remain browser-local.

### Email setup

Set `RESEND_API_KEY`, `INQUIRY_EMAIL_FROM` (a verified sender), `INQUIRY_EMAIL_TO` (the admin recipient), and `APP_URL` (the public site origin). The integration uses the [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email), with the original CV and a Markdown assessment attached and the client's address as reply-to.

A saved inquiry remains available even when mail is not configured or fails. The inbox distinguishes pending, setup needed, failed, and provider-accepted mail. “Accepted” is not a delivery receipt. Admins can retry after fixing configuration; a stable idempotency key prevents duplicate provider requests during its retention window. No real emails are sent by the regression tests.

### Hosting

Use private, writable persistent storage for inquiry records, session records, and admission counters. Share these directories across instances. These runtime files are excluded from build tracing and version control. Back them up separately from browser-local case data.

The anonymous assessment endpoints have hourly admission limits (40 requests per client IP and 500 total; inquiry submission has 5 per client IP and 100 total). Counters are stored under `.data/public-limits`; expired hourly directories may be removed during maintenance. Configure the reverse proxy to overwrite client IP headers rather than accepting arbitrary forwarded headers from the internet. Multipart bodies and JSON request bodies are size-limited before parsing. In high-concurrency or distributed hosting, use a shared transactional rate-limit service for strict admission guarantees.

## Supabase connection

The target project is `https://cvlrhumxbyakxqzhenuw.supabase.co`. The app uses Supabase for consultant inquiry records and original CV attachments. Existing browser-local case workflows, DIY checklists, ideas, and requests retain their current storage.

1. Apply `supabase/migrations/202611020001_petitionpro_inquiries.sql` in this project's SQL Editor, or through an authorized Supabase connection. The migration creates `public.petitionpro_inquiries`, an atomic status-update function, and the private `petitionpro-cvs` bucket. It can be reapplied safely. It aborts if that bucket already exists as public.
2. Put `SUPABASE_URL=https://cvlrhumxbyakxqzhenuw.supabase.co` and `SUPABASE_SECRET_KEY=...` in `.env.local` or your deployment's server environment. Use a new server secret (`sb_secret_...`), or the legacy service-role key as `SUPABASE_SERVICE_ROLE_KEY`. Never use a `NEXT_PUBLIC_` variable for this secret, and do not commit it.
3. Run `node scripts/check-supabase.mjs` to verify API access, the table/function, and the private bucket. It does not create or expose client records.
4. If existing inquiries were saved locally, run `node scripts/migrate-inquiries.mjs` for a count-only dry run, then `node scripts/migrate-inquiries.mjs --apply`. This copies the original CVs and preserves consent timestamps, assessment text, statuses, and email state. Re-running it does not overwrite existing cloud inquiries or resend email. Original local files are preserved.
5. Restart the app with the new server environment. New inquiries and the admin inbox will use Supabase. The Resend settings are still needed for email notifications.

Once any Supabase server setting is present, the app requires a working Supabase configuration. It does not silently switch back to local files after a cloud error. No browser component receives the server key, and CVs continue to download through the authenticated admin route rather than public Storage URLs.

The inquiry table and its patch function deny `anon` and `authenticated` access. The Storage bucket has a restrictive policy protecting CVs even when other buckets have broad client policies. Privileged operations run behind the app's existing admin authorization.

For local SQL validation, run `node scripts/check-supabase-migration.mjs` (PostgreSQL binaries are required; set `PG_BIN` if needed). The check creates a disposable local database and verifies schema idempotency, status merging, and access restrictions. It does not modify your hosted Supabase project.

Admin sessions and free-request admission counters still use the configured server directories. Deployments must provide persistent writable storage for those directories; Supabase inquiry storage does not replace them.
