<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## ProtoPilot contributor instructions

- In this Cloud Shell workspace, edit `/tmp/protopilot`. `/home/adeloyeadetayo8/protopilot` is a mirror and must not be edited. In other environments, use your own checkout. Check `git status` before editing and preserve changes you did not make.
- Read [docs/README.md](docs/README.md) and the relevant source before changing behavior. The workbench uses `/api/assistant`; the older `/api/projects/generate` and `/api/projects/revise` routes still exist but are not the workbench's main chat path.
- Keep `lib/project/schema.ts`, `lib/ai/compact-project.ts`, derived views, firmware, validation, and IndexedDB persistence consistent when changing the project model. Do not describe an unknown electrical rating as verified or claim a generated circuit is safe to power.
- Keep `GEMINI_API_KEY` server-side. Never put it in a `NEXT_PUBLIC_` variable, log it, commit `.env.local`, or paste it into an issue or pull request.
- For UI changes, check the initial chat and an open project's chat. Questions should keep the current design and conversation; design actions should update the same project ID. Check narrow and mobile layouts when changing the workbench.
- Run checks relevant to the change: `pnpm typecheck`, `pnpm lint`, `pnpm test:storage`, and `pnpm build`. A production build catches prerender failures that typecheck does not. Generate random IDs in effects or event handlers, never during Client Component render.
- Use focused conventional commits (`type(scope): message`). Do not commit unrelated work. Deploy or change remote services only when the user asks for it.
