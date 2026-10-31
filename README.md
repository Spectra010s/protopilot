# ProtoPilot

ProtoPilot is an open-source electronics design assistant. Describe a circuit in chat and it can create an editable project with components, pin connections, a breadboard diagram, a schematic, Arduino firmware, build steps, and review checks. You can keep talking to the assistant, ask it to change the design, or ask to see a diagram or code in the conversation.

This is a working prototype. Generated hardware plans need a human review before anything is powered.

## What works

- **One project model:** components and connections feed the breadboard SVG, schematic SVG, wiring table, and checks.
- **Conversational assistant:** Gemma 4 streams replies. It has tools to save a design and show the diagram, schematic, or code; ordinary questions can receive a text answer without changing the project.
- **Local drafts:** projects and chat messages are saved in browser IndexedDB. **My projects** reopens drafts on the same device and browser profile.
- **Useful exports:** download the current diagram as SVG, wiring rows as CSV, and Arduino firmware as a file, or copy code from chat.

There are no accounts or cloud-synced projects. The active electrical checks cover a limited set of patterns and are especially tailored to the original plant-watering demo.

## Run locally

You need Node.js **22.13+** and the pinned **pnpm 11.8.0**. With Corepack available:

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Put a Google Gemini API key in `.env.local` as `GEMINI_API_KEY` to use the assistant. The optional `GEMMA_MODEL` defaults to `gemma-4-26b-a4b-it`. The key is read only by server routes; never put it in a `NEXT_PUBLIC_` variable or commit `.env.local`.

Open the local URL printed by `pnpm dev` and go to `/workbench`. The UI can be explored without an API key, but assistant requests require one.

## Check a change

```bash
pnpm typecheck
pnpm lint
pnpm test:storage
pnpm build
```

The production build also catches Next.js prerender errors that typecheck cannot. Stop a dev server in the same checkout before running a local build because both use `.next`.

## Data and hardware limits

Drafts stay in your browser. When you use the assistant, the current message, recent chat text, and current project go to the ProtoPilot server and then to the configured Google model. AI requests are not processed only in the browser. See [Privacy and hardware safety](docs/privacy-and-safety.md) for the data flow and electrical limits.

Generated wiring, firmware, and checks are drafts. Confirm parts, ratings, pin capabilities, polarity, and supply requirements against datasheets before building or powering a circuit.

## Documentation and contributing

Start with the [documentation index](docs/README.md) for setup, architecture, the project model, assistant tools, and deployment. [CONTRIBUTING.md](CONTRIBUTING.md) explains the contribution workflow; [AGENTS.md](AGENTS.md) adds instructions for AI coding contributors. ProtoPilot is available under the [MIT License](LICENSE).
