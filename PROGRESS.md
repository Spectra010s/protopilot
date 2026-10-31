# ProtoPilot progress

## Current status

- Working directory and git root: `/tmp/protopilot`.
- The generated Next.js App Router uses the root `app/` directory (no `src/` directory).
- UI stack: TypeScript, Tailwind CSS v4, shadcn/ui Base UI `base-nova`, matching the config in `~/fildtek`.
- Drafts and conversation messages use browser IndexedDB (`protopilot.v1`) via `idb`. Images can be stored as Blob assets in a separate object store. This is browser-local persistence, not remote storage. A one-time migration reads the previous `protopilot:project:v1` localStorage draft and removes it after a successful migration.
- ProtoPilot naming is reflected in the app/package.
- Workspace styling is expressed as Tailwind utility classes in JSX; `app/globals.css` is limited to Tailwind imports, theme tokens, and base resets.

## Decisions

- Canonical project model is versioned and Zod-validated. Breadboard SVG, schematic SVG, wiring table, firmware, and deterministic checks all derive from the same project data.
- RunFrame was evaluated for the schematic proof of concept. Its published browser bundle imports many packages missing from its declared production dependencies, including Radix UI packages. The active schematic uses a small app-owned SVG renderer. The RunFrame prototype remains in `components/tscircuit-schematic.tsx` for reference and is not imported by the app.
- Normal `pnpm dev` and `pnpm build` use Next.js defaults (Turbopack). A Webpack diagnostic can be run with `pnpm build -- --webpack`. Turbopack build diagnosis is left to the user.
- AI integration is server-side through Vercel AI SDK and `@ai-sdk/google`. This hackathon build uses Gemma 4 as its only provider; `GEMINI_API_KEY` and `GEMMA_MODEL` stay server-side. The default is the documented and live-tested `gemma-4-26b-a4b-it` model, configurable server-side.
- Live Gemma 4 calls through the installed AI SDK confirmed plain text and Zod-validated structured output. Gemma thinking is set to minimal. The configured key is stored only in ignored `.env.local`.
- No voice/image input flow, accounts, or remote persistence before the core demo is complete. IndexedDB image Blob storage is only a persistence primitive; no image UI currently uses it.

## Phase status

### Phase 1 — Technical proof of concept

- [x] Breadboard SVG renders components and connections from the project model.
- [x] Schematic SVG renders components, pin labels, nets, and wires from the same project model.
- [x] Wiring table derives rows from the canonical connection list.
- [x] Updating connection `c3` changes the shared state used by both views and wiring. API revision flow was exercised with GPIO35.
- [x] RunFrame integration was attempted; Webpack reported unresolved transitive imports from RunFrame/core. Switched to the custom SVG schematic and recorded the reason above.
- [ ] Browser-driven click test for switching tabs and visual layout at mobile widths.

### Phase 2 — Core foundation

- [x] Next.js root App Router structure, Zod schema, catalog, deterministic checks, plant fixture, and firmware.
- [x] Electrical ratings that are not confirmed remain explicit as unknown/assumed.

### Phase 3 — Main application

- [x] Landing page at `/` with hero, feature highlights, how-it-works, and CTA linking to the workbench.
- [x] Workbench moved to `/workbench` route — keeps all functionality intact.
- [x] Responsive workbench with project prompt, overview, component list, breadboard/schematic tabs, wiring table, firmware, validation, and assistant panel.
- [x] Projects autosave to browser IndexedDB; conversation messages are stored per project.
- [x] My projects dialog lists saved drafts and reopens the selected project.
- [x] Firmware can be copied/downloaded; connection changes update the same model used by views/table.
- [x] Multi-project save/open library is implemented in browser IndexedDB.
- [ ] Export (project file, CSV/PDF, diagram download) is not implemented.

### Phase 4 — AI integration

- [x] Provider abstraction, server routes, request validation, and canonical Zod validation of model responses.
- [x] Server-side Gemma provider reads the configurable model from `GEMMA_MODEL` and key from `GEMINI_API_KEY`.
- [x] Vercel AI SDK Google provider uses Gemma 4. Structured outputs use `Output.object()` with the canonical Zod schemas; Gemma thinking is set to minimal.
- [ ] Full plant design generation and revision through the app routes remain to be verified.

### Phase 5 — Verification

- [x] `pnpm typecheck` passed.
- [x] `pnpm lint` passed with warnings only (unused variable and existing config/style warnings).
- [x] `pnpm test:storage` passed for project drafts, messages, SVG Blob assets, and legacy localStorage migration.
- [x] Webpack diagnostic production build passed after the Tailwind JSX refactor. Use `pnpm exec next build --webpack`; `pnpm build -- --webpack` forwards an extra `--` that Next interprets as the project directory.
- [x] Installed AI SDK integration returned plain text and a Zod-validated JSON object from Gemma 4.
- [ ] Full plant design response and conversational revision via app routes are being verified.
- [ ] Normal Turbopack production build and browser visual interaction tests remain unverified. The user is investigating the local Turbopack build issue; do not change the default bundler for shipping.

## Commands and environment

- Install: `pnpm install --config.strict-dep-builds=false`
- Dev: `pnpm dev`
- Typecheck: `pnpm typecheck`
- Default build: `pnpm build` (Turbopack)
- Diagnostic Webpack build: `pnpm build -- --webpack`
- Gemma config: copy `.env.example` to `.env.local`, then set `GEMINI_API_KEY`; `GEMMA_MODEL` defaults to `gemma-4-26b-a4b-it`.

## Remaining work

- Verify normal Turbopack build after the user's diagnosis.
- Run a browser-driven flow to click both diagram tabs and check mobile layout.
- Browser-driven click test for the project library and mobile layout remains outstanding.
- Add export after the core flow is stable.
- **Type scale (deferred by user, not done):** the UI leans small — many labels are 8–10px and the body text is 13px. Target: body 13–14px, labels never below 10–11px, headings 15–18px. Do this as its own pass so it does not collide with the Tailwind/token work, and re-check every `text-[Npx]` utility in `app/page.tsx` at that time.
- Wire or hide the remaining non-functional affordances (Download diagram, Expand, zoom +/−, Edit overview, Add component, Export CSV, full assembly guide, constraint chips, assistant settings).
