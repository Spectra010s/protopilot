# Deployment

The app is deployed as a Next.js project on Vercel. The repository pins `pnpm@11.8.0` in `package.json`; the lockfile is generated with that version. In Vercel, use a Node.js version compatible with pnpm 11.8.0 (Node 22.13 or newer) and set `ENABLE_EXPERIMENTAL_COREPACK=1` so the build uses the pinned package manager.

## Environment variables

| Name | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side key for assistant requests; store as a secret. |
| `GEMMA_MODEL` | Optional model ID; defaults to `gemma-4-26b-a4b-it`. |
| `ENABLE_EXPERIMENTAL_COREPACK` | Set to `1` for Vercel builds using the pinned pnpm version. |

Never prefix the API key with `NEXT_PUBLIC_`. The assistant route returns an error if the key is absent. Browser drafts remain on each user's device after deployment.

## Release check

Before deploying, run `pnpm typecheck` and `pnpm build`, or inspect the same checks in the Vercel build log. In particular, confirm `/workbench` prerenders successfully. Browser-only values such as `crypto.randomUUID()` must be created in effects or event handlers, not during Client Component render.

Deploy from the project root with `vercel deploy --prod --yes`, or use the repository's Git integration. Confirm the deployment reaches **Ready**, inspect the production alias, and test the workbench in a browser. Vercel Authentication or custom-domain DNS/TLS settings can prevent public access even when the build is Ready; verify access separately from build status.
