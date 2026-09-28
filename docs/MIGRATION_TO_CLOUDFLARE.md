# EduWallet migration: Supabase to Cloudflare + Neon + Clerk + R2

## Target architecture
- Runtime/hosting: Cloudflare Workers running the existing TanStack Start application.
- Database: Neon PostgreSQL. The current application already uses PostgreSQL semantics.
- Authentication: Clerk, using its official TanStack React Start SDK and supported password-digest import.
- Private files: Cloudflare R2 with short-lived signed URLs.
- Legacy source: Supabase stays online during migration and rollback validation.

## Why this stack
Cloudflare supports TanStack Start directly on Workers. Neon is PostgreSQL and can be reached from Workers through Hyperdrive. R2 has free Internet egress and supports presigned URLs. Clerk has a dedicated TanStack React Start SDK and password-digest import support.

This avoids rewriting the database to SQLite/D1 and avoids an unsupported password migration.

## Current EduWallet dependency inventory
- Email/password sign-up, login, password recovery and sessions.
- profiles and user_roles.
- categories, products, exams, courses and subjects.
- orders and payment proofs.
- contact_messages and site_settings.
- Private storage for covers, previews, product PDFs and payment proofs.
- Customer-library access based on verified orders.
- The verify-and-deliver edge function.

## Cutover sequence
### Phase 1 — preparation
1. Create Cloudflare, Neon, Clerk and R2 resources.
2. Add production secrets only in provider dashboards/CI secrets.
3. Export the complete Supabase PostgreSQL database.
4. Export Supabase Auth users and inspect the password-hash format.
5. Copy all four storage buckets to R2 and verify counts/checksums.
6. Keep the current Supabase deployment live.

### Phase 2 — application migration
1. Replace the browser Supabase client with Clerk session state.
2. Move authorization to server-side boundaries.
3. Replace Supabase table calls with server-side PostgreSQL queries.
4. Replace Supabase Storage with R2 signed URLs.
5. Port verify-and-deliver to a Cloudflare server function.
6. Preserve existing business fields and order history.
7. Map legacy Supabase user IDs to Clerk IDs during transition.

### Phase 3 — validation
Test registration, existing-user login, password recovery, admin authorization, product management, uploads, checkout, payment verification, WhatsApp delivery, customer library, secure PDF access, contact messages, settings, mobile layout, 404, sitemap/robots, HTTPS and security headers.

### Phase 4 — cutover
1. Briefly freeze writes.
2. Run final database and storage syncs.
3. Verify record/object counts.
4. Point production DNS to Cloudflare.
5. Smoke-test login, checkout, admin and library.
6. Keep Supabase available for rollback.
7. Delete Supabase only after the rollback window has passed.

## Important migration constraint
Do not delete Supabase before validation. Supabase documents pg_dump/restore for PostgreSQL migrations and separately identifies Auth settings and storage objects as migration items.

Clerk supports importing password digests for multiple hashing algorithms. The actual exported Supabase hash format must be inspected before importing users. If it is incompatible, use a controlled password-reset migration instead of converting hashes unsafely.

## Why the migration branch exists
Provider credentials and database secrets cannot safely be committed to Git. The migration branch is isolated from main so the currently deployed EduWallet site remains operational while the replacement backend is prepared.