# ProtoPilot progress

## Current status

- The project uses create-next-app's root `app/` directory. There is no `src/` directory.
- The repo is initialized with Next.js 16.4.3, React 19.3.0, TypeScript 5.9, Tailwind CSS v4, and shadcn Base UI `base-nova`, matching `~/fildtek`.
- Core demo schema, catalog, validation, fixture, wiring derivation, breadboard renderer, and RunFrame source generator are present under root `lib/` and `components/`.
- `pnpm typecheck` passes after repairing an existing missing parenthesis in `lib/project/derive.ts`.
- A production build was started, but was manually stopped after more than a minute without further output while Next.js was compiling the RunFrame integration. Build result is unverified.

## Decisions

- Approved stack: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui Base UI with `base-nova`.
- Canonical project schema is app-owned, versioned, and Zod-validated.
- All views, connections/wiring, firmware, and validation are derived from the same project representation.
- Use tscircuit/RunFrame for a bounded schematic proof of concept; keep a custom SVG breadboard renderer. If the tscircuit integration does not prove workable, use the app-owned SVG schematic renderer too and record why.
- Gemma calls stay server-side. The model name is set in `GEMMA_MODEL`, with no client-side model constant. Mock provider remains available.
- Browser local storage only; no authentication or database.
- No voice or image work before the core workflow.

## Phase log

### Phase 1 — Technical proof of concept

- [ ] Render a schematic using RunFrame from canonical connection data.
- [x] Render a breadboard SVG from canonical connection data.
- [ ] Change a connection and verify both views update at runtime.
- [x] Wiring table derivation uses the canonical connection list.
- [ ] Record the schematic package/runtime verification result.

### Phase 2 — Core foundation

- [x] Next.js project structure with root App Router.
- [x] Versioned Zod project schema.
- [x] Curated catalog and explicit unknown/assumed component specs.
- [x] Deterministic validation baseline.
- [x] Smart plant watering fixture and Arduino firmware.

### Phase 3 — Main application

- [ ] Responsive project workspace and creation prompt.
- [ ] Overview, component list, two circuit views, wiring table, firmware, validation.
- [ ] Conversational revision interface.
- [ ] Local persistence.

### Phase 4 — AI integration

- [ ] Provider abstraction.
- [ ] Mock generation and revisions.
- [ ] Server-side Gemma 4 provider with configured model.
- [ ] Schema and semantic validation of model responses.
- [ ] Clarification questions.

### Phase 5 — Verification

- [ ] Generate plant project.
- [ ] Inspect components and wiring.
- [ ] Switch both views.
- [ ] Review firmware.
- [ ] Modify a component and verify consistent updates.
- [ ] Record commands/results and remaining blockers.

## Recent verification

- `pnpm install --config.strict-dep-builds=false` — succeeded.
- `pnpm dlx shadcn@latest info --json` — confirms Next.js, `srcDirectory: false`, Base UI, `style: base-nova`, Tailwind v4, and `app/globals.css`.
- `pnpm typecheck` — passed after fixing `lib/project/derive.ts`.
- `pnpm build` — started with Next.js 16.4.3/Turbopack; remained in compilation without further output for over a minute and was stopped. Investigate RunFrame bundling separately.

## Blockers and follow-up

- RunFrame has not yet been verified in a browser. The production build paused during compilation; investigate whether package bundling or the build environment is responsible before treating it as a renderer failure.
- API routes for project generation and revision, UI styling, and local persistence remain to be implemented.
