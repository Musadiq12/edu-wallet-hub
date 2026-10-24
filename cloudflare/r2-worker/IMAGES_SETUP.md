# Cloudflare Images setup for EduWallet Hub

The admin app uploads product covers, blog covers, and homepage hero images through the existing `edu-wallet-r2` Worker. Supabase remains the database and authentication provider; PDF uploads continue to use R2.

## Required Cloudflare configuration

Cloudflare Images hosted storage/API uploads require an Images plan for this account. Confirm billing and pricing in the Cloudflare dashboard before enabling uploads.

In **Workers & Pages → edu-wallet-r2 → Settings → Variables and Secrets**, add:

- `CF_IMAGES_ACCOUNT_ID` — the Cloudflare account ID that owns the Images library.
- `CF_IMAGES_API_TOKEN` — a Cloudflare API token scoped to the correct account with Cloudflare Images read/write permissions. Store it as a secret, not a plain-text variable.

Save the changes and redeploy the Worker if the dashboard requests it. The existing GitHub deployment workflow deploys the Worker when changes reach `main`; it does not create these runtime secrets automatically.

## Behavior

- The Worker validates the admin's Supabase access token and admin role before upload or deletion.
- The browser never receives the Cloudflare API token.
- Image uploads are limited to 5 MB and JPEG, PNG, WebP, GIF, or AVIF.
- The database stores the Cloudflare Images delivery URL in the existing cover-image fields.
- Existing Supabase Storage paths continue to render through the legacy fallback. New uploads use Cloudflare Images.
- Supabase Storage is not automatically purged or migrated by this code; existing images remain where they are until separately migrated or deleted.
