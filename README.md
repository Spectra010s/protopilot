# ProtoPilot

CircuitCraft turns a hardware idea into an editable project representation with components, electrical pins, connections, a breadboard layout, a schematic, firmware, assembly notes, and deterministic checks.

## Run locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
pnpm dev
```

The project uses Next.js App Router, TypeScript, Tailwind CSS v4, and shadcn/ui Base UI `base-nova`. `pnpm dev` and the normal production build use Turbopack. To run a separate Webpack diagnostic build, use `pnpm build -- --webpack`. Type checks and production build:

```bash
pnpm typecheck
pnpm build
```

## AI provider

The default provider is a local mock, so the demo works without credentials. It generates the plant watering fixture for plant/soil/watering requests, asks clarification questions for other prompts, and demonstrates changing the moisture input between GPIO34 and GPIO35.

To enable Gemma 4, copy `.env.example` to `.env.local`, set `AI_PROVIDER=gemma`, and add a server-side Google AI Studio key. The app uses Vercel AI SDK with its Google provider; the default model ID is `gemma-4-26b-a4b-it` and can be overridden with `GEMMA_MODEL`:

```env
AI_PROVIDER=gemma
GEMINI_API_KEY=your-server-side-key
GEMMA_MODEL=gemma-4-26b-a4b-it
```

Gemma 4 model IDs currently documented for Gemini API include `gemma-4-26b-a4b-it` and `gemma-4-31b-it`. Structured generation and project revisions are validated against the app's Zod schema before returning. `GEMMA_MODEL` and `GEMINI_API_KEY` are read only by server routes. Never add the API key to a `NEXT_PUBLIC_` variable.

## Demo flow

1. Describe a plant watering system and select **Generate**.
2. Inspect its components, ratings, connections, firmware, and engineering checks.
3. Switch between **Breadboard** and **Schematic**. Both SVG views and the wiring table use the same versioned project data.
4. Use **Change test connection**, or ask the mock assistant to move the moisture input to GPIO35. The connection and firmware update, and both views and the wiring table re-render from the changed project.
5. Reload the page; the current project and conversation are restored from browser IndexedDB. Open **My projects** to reopen another saved design on this device.

## Engineering limits

- The project schema and deterministic checks catch a limited set of known issues. Passing checks do not guarantee a circuit is safe or will work.
- Exact pump, MOSFET, diode, and sensor ratings remain unknown until part numbers and datasheets are selected.
- The RunFrame proof of concept is retained at `components/tscircuit-schematic.tsx`. It is not loaded by the application: its published browser bundle imports runtime packages absent from its declared production dependencies, and its bundle also pulls in Radix UI packages. The active schematic is a small app-owned SVG renderer using the canonical project model.
- Voice and image input, export, accounts, and remote persistence are not implemented. Projects currently stay in this browser; use a server-side database/object store later if cross-device access or cloud backup is needed.
- Workspace presentation uses Tailwind utility classes in JSX. `globals.css` contains Tailwind imports, theme tokens, and base resets.

## Project notes

See [RESEARCH.md](./RESEARCH.md) for the technical research and [PROGRESS.md](./PROGRESS.md) for implementation status and verification notes.
