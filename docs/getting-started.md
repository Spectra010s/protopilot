# Getting started

## Requirements

- Node.js 22.13 or newer. The pinned pnpm 11.8.0 release requires this Node version.
- pnpm 11.8.0, as declared in `package.json`. Corepack can select the pinned version.
- A Gemini API key only if you need to use the AI assistant. The rest of the UI can be developed without one.

## Local setup

From your checkout:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Set `GEMINI_API_KEY` in `.env.local` before trying the assistant. `GEMMA_MODEL` defaults to the value in `.env.example`. Do not commit `.env.local` or use a `NEXT_PUBLIC_` key. Open the URL printed by `pnpm dev`, then visit `/workbench`.

`next.config.ts` includes Cloud Shell development origins for this repository's demo workspace. They affect development requests only. Contributors using another host can run the normal local URL without copying those hostnames.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test:storage
pnpm build
```

Use the checks relevant to your change. `pnpm build` is important for workbench changes because Next.js also prerenders Client Components during a production build. If `pnpm dev` is running in the same checkout, stop it before a local build so both processes do not write `.next` at once.

The workbench saves drafts in browser IndexedDB. A new browser profile or device has its own drafts. The application has no account or cloud sync feature.
