<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep product pricing validation and genuine-discount decisions in `src/lib/format.ts` so admin forms and public displays use the same rules.
- Keep manual admin email payload rules in `src/lib/admin-email.ts` and invoke the deployed function through the existing browser client; this preserves one auth source and prevents sensitive record fields entering emails.
- Keep admin email receipts and decision snapshots in user-scoped, session-only query state, not database tables or persistent browser storage; no suitable email audit infrastructure exists.
