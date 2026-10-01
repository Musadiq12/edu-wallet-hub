# EduWallet Cloudflare R2 Worker

This Worker keeps paid product PDFs private in the `edu-wallet-products` R2 bucket.

## Endpoints

- `GET /health` — health check.
- `PUT /upload?filename=...` — admin-only PDF upload using the Supabase access token.
- `DELETE /delete?key=...` — admin-only object deletion.
- `POST /delivery-link` — internal endpoint used by the Supabase delivery function to create a 48-hour download URL.
- `GET /download?key=...&exp=...&sig=...` — validates the signed URL and streams the private PDF.

## Cloudflare setup

Create an R2 bucket named `edu-wallet-products`, then deploy this Worker with the R2 binding in `wrangler.jsonc`.

Set these Worker secrets:

```
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVER_KEY
npx wrangler secret put DOWNLOAD_SIGNING_SECRET
npx wrangler secret put DELIVERY_SECRET
```

Set `ALLOWED_ORIGIN` to the actual EduWallet website origin.

The paid PDFs remain private; no public R2 bucket or public custom-domain URL is required.

The current 50 MB product-file limit is below Cloudflare's current 100 MB request-body limit on Free/Pro Workers requests, so the direct upload endpoint is sufficient for the existing application limit. For larger files, switch the upload route to R2 multipart uploads.
