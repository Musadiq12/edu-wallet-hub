# Cookie consent redesign — legal and QA notes

- The cookie banner is an opaque white, bottom-right card with Accept, Reject and Manage controls. On a fresh visit it is presented after 90 seconds; consent defaults are denied immediately and optional vendors must remain blocked until a choice.
- Optional category choices remain off by default, and the persistent Cookie settings control remains available after a choice.
- India legal context: Digital Personal Data Protection Act, 2023 (Act 22 of 2023), commencement notification G.S.R. 843(E), 13 November 2025; Digital Personal Data Protection Rules, 2025, G.S.R. 846(E), 13 November 2025. Sections 3–17 and Rules 3, 5–16, 22–23 have an 18-month phased commencement from publication (around 13 May 2027); Rule 4 has a 12-month timeline (around 13 November 2026). Check current Gazette corrigenda and applicable sector/foreign law before treating this as legal advice.
- The Cookie Policy requires an inventory of deployed cookies/scripts/providers, retention times and verified operator/contact. Do not enable vendors missing from the inventory. Confirm the consent-record migration is applied to the production Supabase project before relying on server-side audit persistence.

## Verification required before production release

1. Run lint, production build and the repository's cookie UI workflow.
2. In a fresh browser profile, confirm the notice appears after 90 seconds and remains opaque on desktop/mobile.
3. Network trace before choice: no non-essential analytics/advertising scripts, requests or storage. CSS and a banner cannot stop independently hardcoded vendor tags.
4. Test Accept, Reject, Manage/category toggles, save, reload, expiry/policy-version re-prompt and footer Cookie settings. Test keyboard focus and small viewports.
5. Confirm current production Supabase schema, RLS and consent-record insert behavior.
