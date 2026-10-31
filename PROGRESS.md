# ProtoPilot status

This file records the current prototype state. The contributor-facing explanations live in [docs/](docs/README.md); [RESEARCH.md](RESEARCH.md) is earlier planning material, not a description of the current code.

## Implemented

- Next.js App Router landing page and workbench.
- Versioned Zod project model with components, pins, connections, firmware, build steps, assumptions, and warnings.
- Breadboard and schematic SVG views, wiring table, and deterministic electrical checks derived from the project model.
- Gemma 4 assistant through the Vercel AI SDK and Google provider. The workbench uses `/api/assistant` for streaming replies and tool actions to create or update designs and show diagram, schematic, or code cards.
- Browser IndexedDB storage for project drafts, chat messages, and image Blob assets. There is no localStorage migration or cloud sync.
- Firmware download/copy, wiring CSV export, and diagram SVG download.
- Production Vercel build with pnpm 11.8.0; `/workbench` prerenders successfully. Production environment variables are configured server-side.

## Known limits

- The electrical checks cover a small set of rules and include plant-watering-specific assumptions. They do not prove a circuit is safe.
- The design tool replaces a project from a compact plan. It does not apply a targeted component patch, so revisions still need careful review.
- There are no accounts or server-backed drafts. Browser storage is local to each profile.
- Image Blob storage exists, but there is no image-input workflow. Voice input is also not implemented.
- The older `/api/projects/generate` and `/api/projects/revise` routes remain in the tree; the workbench chat uses `/api/assistant`.
- A deployed build can be Ready while custom-domain access or Vercel Authentication still limits who can open it. Check public access separately.

## Verification

- The production Vercel build completed on 31 October 2026, including TypeScript and static prerendering for `/workbench`.
- `pnpm typecheck` and lint passed for the recent chat work; lint reported only existing warnings.
- `pnpm test:storage` covers drafts, messages and artifacts, and SVG Blob storage.

When changing behavior, run the relevant checks from [CONTRIBUTING.md](CONTRIBUTING.md) and update this page if the project's status changes.
