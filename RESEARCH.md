# ProtoPilot: technical research and proposed architecture

**Status:** research only. No application implementation or dependencies have been added. The architecture below is a proposal for review.

**Workspace:** `/tmp/circuitcraft`  
**Product name:** ProtoPilot  
**Research date:** 2026-10-31

## Executive recommendation

Build a Next.js App Router application with TypeScript, Tailwind CSS, and shadcn/ui. Keep the semantic project model owned by the application and validate it on the server. Use Google Gemma 4 through a server-side provider, with a mock provider for demos that do not have API credentials. Persist projects in browser local storage for the MVP.

Use one structured circuit model for both diagram views, the wiring table, firmware, and validation. tscircuit's Circuit JSON and React viewer are promising for schematic/PCB output, but do not provide a classic solderless-breadboard view. Fritzing has both breadboard and schematic views, but it is a desktop design tool rather than a ready React renderer. Therefore the practical MVP is an application-owned model with an adapter to an existing schematic renderer and a focused breadboard SVG renderer from the same model.

Start with a small catalog whose pin maps and specifications have explicit sources. Unknown ratings must remain unknown. A deterministic validation layer should report passes, warnings, and unverified assumptions; it must never claim that a design is guaranteed safe or functional.

## Research findings

### Breadboard and schematic rendering

| Option | Verified capability | License / browser integration | Recommendation |
|---|---|---|---|
| [Fritzing](https://fritzing.org/learning/get-started/project-view) | Desktop editor with breadboard, schematic, and PCB views. The views describe the same sketch and are updated together. Sketches store component instances, locations, wires, and view data in an XML-based `.fz` file inside `.fzz`. The parts library contains SVG artwork for parts. | Source code is GPL v3. Fritzing states that documentation and breadboard-view graphics are CC BY-SA. It is not a drop-in web or React component. Its graphical part assets also need careful license handling if redistributed. [License details](https://fritzing.org/faq) · [Sketch format](https://github.com/fritzing/fritzing-app/wiki/2.2-Sketch-file-format) | Useful as a reference for what a real breadboard view must communicate. Not the MVP renderer unless we deliberately choose to embed or interoperate with Fritzing and review its licensing and runtime implications. |
| [tscircuit](https://github.com/tscircuit/tscircuit) and [Circuit JSON](https://github.com/tscircuit/circuit-json) | TypeScript/React electronics toolchain. Circuit JSON is its low-level interchange representation. `@tscircuit/runframe` can display Circuit JSON as a schematic, PCB, or 3D/CAD preview; its example accepts `circuitJson` in `CircuitJsonPreview`. It does not expose a solderless breadboard view. [RunFrame usage](https://github.com/tscircuit/runframe) · [Official docs](https://docs.tscircuit.com/) | tscircuit is MIT; Circuit JSON is ISC; RunFrame is MIT. Browser React integration exists. The ecosystem is evolving quickly, so pin versions and isolate it behind an adapter. Its model and rendering conventions are PCB/schematic-oriented, not the product's semantic inventory and safety model. | Best existing option to evaluate for the schematic view and later PCB/export support. Keep the application's own richer project model as canonical. |
| [`@skillpet/circuit`](https://github.com/skillpet/circuit) | JSON-to-interactive-SVG schematic renderer with React/Vue components and pictorial component artwork. The repository describes 200+ symbols, browser ESM/CJS support, and zero required runtime dependencies. The breadboard feature is component artwork, not a physical breadboard with electrically connected holes and shared net semantics. | The repository advertises MIT examples, but its package terms indicate free personal/educational use and separate commercial licensing. Repository activity and adoption are small compared with tscircuit. | Do not make this a core dependency for a hackathon product intended to be broadly usable. It does not satisfy the shared circuit model plus real breadboard requirement. |
| [CircuitJS / Falstad](https://github.com/edudevteam/falstad-circuits-simulator) | Mature interactive browser circuit simulator and schematic editor. Has its own circuit serialization and simulation model. JavaScript integration documentation describes a separate application and same-origin integration needs. [JS interface](https://www.falstad.com/circuit/doc/js-interface.html) | GPL. Embedding means hosting/operating a separate simulator and bridging its data format. It does not render the product's breadboard view or directly consume the app's semantic model. | Defer. Its simulation format and scope are separate from the MVP's shared design model. |

**Conclusion:** I found no maintained, drop-in web package that combines authoritative physical breadboard placement, schematic symbols, and the product-level semantic/electrical model. Use a shared app model; connect that model to a schematic renderer via an adapter; implement only the MVP breadboard layout as SVG. Do not create two independent circuit descriptions.

### Circuit data formats

- **Circuit JSON** is a useful lower-level interchange format for schematic, PCB, and related tscircuit output. It is not a substitute for the product's model of user requirements, component specifications, missing ratings, assumptions, firmware, instructions, or validation outcomes. [Circuit JSON repository](https://github.com/tscircuit/circuit-json) · [tscircuit explanation](https://tscircuit.com/)
- **Fritzing sketch format** stores graphical locations and connections across breadboard, schematic, and PCB views. It is valuable reference material, but its model is specific to the Fritzing editor workflow and is not the best semantic source of truth for an AI design assistant. [Format specification](https://github.com/fritzing/fritzing-app/wiki/2.2-Sketch-file-format)
- **Recommendation:** own a versioned, Zod-validated TypeScript model, then create adapters for renderers and exports. View coordinates are presentation metadata derived from the same component IDs and connections, not independent circuit designs.

### Component libraries and pin definitions

| Source | What it provides | Limitations for this app |
|---|---|---|
| [KiCad symbol libraries](https://github.com/KiCad/kicad-symbols) | Maintained electronics symbols with pin names/numbers and electrical pin types; useful source data for a future import pipeline. | Not a hosted browser component search API or complete source of current module ratings. A chip symbol alone does not establish the pinout/capabilities of a specific development board or sensor breakout. |
| [KiCad library license](https://www.kicad.org/libraries/license/) | Library data is CC BY-SA 4.0. KiCad provides an exception so designs and generated files using the library data do not have to inherit CC BY-SA. Redistributing library material itself remains subject to the library terms. | Review attribution and licensing before copying library files or artwork into the app. |
| [Espressif KiCad libraries](https://github.com/espressif/kicad-libraries) | Official symbols, footprints, and 3D models for Espressif SoCs, modules, and DevKits. Its repository includes installation guidance for KiCad. | These are EDA assets, not a runtime pin-capability API for the app. Use the exact board's documentation for the board's exposed pins. |
| [Espressif ESP32-DevKitC guide](https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32/esp-dev-kits-en-master-esp32.pdf) | Official board pin labels and board-specific context. The ESP32 DevKitC exposes GPIO34 and related input-only pins; exact ADC/pin behavior must be checked against the selected ESP32 board and chip. | Do not generalize this pin map to every board sold as an “ESP32 DevKit.” |
| [Fritzing parts library](https://fritzing.org/parts) | Visual part assets and connectors designed for Fritzing's editor and view workflow. | Not an authoritative database of electrical ratings; part quality and source vary. Part graphics do not replace pin/spec provenance. |

**Recommendation:** begin with a small, curated, versioned TypeScript catalog for the specific supported boards and modules. Each catalog entry should have a stable identifier, pin names and capabilities, electrical ratings where verified, source URL, and provenance/status. Leave unknown ratings `null` and surface them as warnings or questions. For the plant demo, verify the exact ESP32 board pin map and the exact moisture sensor and pump before asserting signal/voltage/current values.

### Validation and simulation

**Validation** should be deterministic and separate from model generation. Component rules should only use sourced catalog values and user-supplied values. Recommended first checks:

1. Every component and connection references an existing component ID and pin.
2. No required power, ground, or signal connections are missing.
3. Pin direction and board capability match the intended role (input, output, ADC, PWM, etc.).
4. Logic-level compatibility is checked only when the relevant values are known.
5. An ESP32 GPIO is never used to drive a pump directly.
6. A pump circuit includes a suitable switching device, flyback protection for an inductive DC load, external pump power, and common ground when using a non-isolated low-side switch.
7. The pump's rated voltage/current, MOSFET gate threshold/current/thermal suitability, diode rating, and supply capability are explicitly unknown until tied to exact parts or user-provided specs.
8. Keep water paths and exposed electronics physically separated in the assembly instructions.

Report **passed**, **warning**, **failed**, or **unverified** checks with a short reason and the data used. Passing these checks is not a guarantee of safety or function.

Simulation options:

- [Wokwi](https://docs.wokwi.com/) documents hosted simulation of microcontrollers including [ESP32](https://docs.wokwi.com/guides/esp32). It is useful for a later firmware demo, but is not documented as a drop-in React renderer for arbitrary app circuit models.
- [`spice-ts`](https://github.com/mfiumara/spice-ts) provides SPICE-style analysis for a netlist; it will not simulate soil moisture, generated firmware, or the physical quality of a pump installation.
- [`circuit-json-to-spice`](https://github.com/tscircuit/circuit-json-to-spice) bridges Circuit JSON toward SPICE. It is an ecosystem package, not a system-level safety validator.
- [Circuit JSON utilities](https://github.com/tscircuit/circuit-json-util) focus on Circuit JSON / PCB-related operations; they do not replace design-intent rules for the plant system.

**Recommendation:** no simulator in the first core workflow. Add a Wokwi handoff or a carefully scoped simulator integration later, keeping simulation status distinct from electrical validation.

### Voice and image input

- The [Web Speech `SpeechRecognition` API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) is marked limited availability. Some browser implementations use a remote recognition service, can require connectivity, and may transmit audio outside the app. Treat it as an optional progressive enhancement, show/confirm the transcript, and preserve text entry.
- [`getUserMedia`](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) and [`MediaRecorder`](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder) are broadly available browser APIs. Microphone capture requires permission and a secure context (HTTPS or localhost). Check `MediaRecorder.isTypeSupported()` because supported audio formats vary. A server transcription endpoint would still be needed.
- Google lists Gemini transcription models separately from Gemma. A later voice path can record audio in the browser and send it to a server-side transcription provider. Keep this separate from circuit generation and do not require it for the MVP.
- Gemma 4 supports multimodal inputs according to the [official Gemma 4 documentation](https://ai.google.dev/gemma/docs/core), but image-based circuit interpretation is still a separate, uncertain feature. Defer it until text-to-structured-design works reliably.

### UI stack

- [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation) provides TypeScript support, server rendering, and server route handlers in one application. Current docs list Node.js 20.9 as the minimum and modern browser support.
- [shadcn/ui Next.js setup](https://ui.shadcn.com/docs/installation/next) installs accessible components into the project source so they can be composed and customized. [Tailwind v4 support](https://ui.shadcn.com/docs/tailwind-v4) is documented with React 19.
- Use shadcn primitives for forms, buttons, tabs, cards, tables, dialogs/sheets, badges, and alerts. Use custom SVG only for the circuit-specific views. Add a syntax highlighting package only if needed after the core workflow is in place.

## Proposed application architecture

### Project structure

```text
src/
  app/
    page.tsx                     # responsive project workbench
    layout.tsx                   # app shell, metadata, global styles
    api/
      projects/generate/route.ts # create structured project / clarification response
      projects/revise/route.ts   # conversationally revise the canonical model
      transcribe/route.ts        # optional later; omit for core MVP
  components/
    project-workspace.tsx
    circuit-view-switcher.tsx
    breadboard-view.tsx
    schematic-view.tsx
    wiring-table.tsx
    firmware-panel.tsx
    validation-panel.tsx
  lib/
    ai/
      provider.ts                # provider interface and typed results
      mock-provider.ts           # deterministic demo behavior
      gemma-provider.ts          # server-only Google API implementation
    project/
      schema.ts                  # Zod schema, inferred types, versioning
      catalog.ts                 # curated component and board definitions
      validation.ts              # deterministic rules
      transformations.ts         # recompute/derive outputs from model
    renderers/
      circuit-json-adapter.ts    # optional schematic viewer adapter
      breadboard-layout.ts       # layout for SVG using canonical component IDs/nets
    storage/
      local-projects.ts          # browser localStorage persistence
```

### Canonical project model

The model should be semantic and versioned. A starting outline:

```ts
type Project = {
  schemaVersion: number;
  id: string;
  metadata: {
    title: string;
    summary: string;
    prompt: string;
    status: "needs_clarification" | "draft" | "ready";
  };
  constraints: {
    preferredController?: string;
    availableComponents: string[];
    budget?: { amount: number; currency: string };
    requirements: string[];
  };
  components: ComponentInstance[];
  connections: Connection[];
  powerDomains: PowerDomain[];
  firmware: { language: string; board: string; source: string };
  buildSteps: string[];
  assumptions: Assumption[];
  warnings: Warning[];
  clarificationQuestions: string[];
  presentation: { breadboard?: Layout; schematic?: Layout };
};
```

Each component should include its stable ID, catalog part ID, reference designator, display name, category, verified specifications (with units and source/provenance), and explicit pins. Each pin should describe its role/capabilities and any known voltage/current limits. Each connection should identify both endpoint component IDs and pin IDs, plus signal/net label, connection details, and known voltage/current context. Keep unknown values explicit (`null` or `unknown`) rather than filling them with plausible numbers.

The component list, wiring table, both views, firmware, and validation results should be derived from this project. A revision updates the canonical model, then recomputes affected views and checks.

### AI provider and structured response handling

Define an interface such as:

```ts
interface DesignProvider {
  generate(input: UserRequest): Promise<DesignResult>;
  revise(project: Project, request: string): Promise<DesignResult>;
}
```

`DesignResult` should be either a validated project or a clarification result containing targeted questions and any explicit assumptions. Use a small JSON Schema/Zod schema for model-constrained output. Then parse and validate the returned payload on the server, including references, IDs, required fields, and known semantic constraints. If malformed, retry once with a repair prompt or return a graceful recoverable error; do not render an invalid project as if it were verified.

Google's API has a subset of JSON Schema structured output; the official docs explicitly recommend validating constraints on the client/server after parsing. [Structured output guidance](https://ai.google.dev/gemini-api/docs/structured-output)

Use `GEMINI_API_KEY` and `GEMMA_MODEL` only in server environment variables. The current [Interactions API model list](https://ai.google.dev/gemini-api/docs/interactions-overview) lists `gemma-4-31b-it` and `gemma-4-26b-a4b-it`; keep the actual selection configurable rather than hardcoding it in client code. Gemma 4 is also available as open weights for self-hosted inference. [Official Gemma 4 docs](https://ai.google.dev/gemma/docs/core)

### Persistence and deployment

- Browser local storage stores serialized, versioned project documents. On load, migrate older schemas or report a recoverable incompatibility.
- No authentication or database is required for the hackathon MVP.
- Deploy as a Node-capable Next.js application (for example, Vercel or Cloud Run) because generation/revision calls must execute server-side. Do not use static-only hosting for the Gemma integration.
- Configure `GEMINI_API_KEY`, `GEMMA_MODEL`, and a provider switch such as `AI_PROVIDER=mock|gemma` in the server environment. Never place secrets in `NEXT_PUBLIC_*` variables.
- A mock provider should be the default when no model key is configured and should support the plant example and a small set of useful edits so the demo remains repeatable.

## Demonstration project: smart plant watering

Use ESP32, capacitive soil moisture sensor, a low-voltage DC pump, an appropriate logic-level MOSFET driver, flyback diode, external pump supply, and optional status LED/manual button.

The initial design must explicitly say:

- The pump must never connect directly to an ESP32 GPIO.
- Pump voltage and current are unknown until the exact pump is selected.
- MOSFET and diode ratings must be checked against that pump's supply and current.
- A separate external pump supply is required; tie its ground to ESP32 ground for a non-isolated low-side switch.
- The selected sensor module's output range must be checked; do not assume it is safe for the selected ADC input.
- Keep water containers/tubing away from exposed electronics and connections.

Firmware should read the moisture sensor, compare against an adjustable threshold with hysteresis or a cooldown to avoid rapid switching, run the pump through the driver for a bounded duration, and allow a debounced manual button. The code and component details should be regenerated from the same selected board/pin assignments.

## MVP implementation sequence after approval

1. Scaffold Next.js + TypeScript + Tailwind + shadcn in `/tmp/circuitcraft`.
2. Define the versioned project schema, the small catalog, and the plant example fixture.
3. Add deterministic electrical checks and render their output visibly.
4. Build the responsive workspace, wiring table, firmware panel, and local storage.
5. Render both circuit views from the shared model; evaluate RunFrame via a small adapter for schematic display and use a generated SVG for the breadboard view.
6. Add mock generation/revisions and exercise: initial generation, sensor replacement, controller replacement, manual button, and component explanation.
7. Add the server-side Gemma provider with configured model ID and structured output validation.
8. Verify the build and the required demo flow; document env vars, limitations, and run commands.
9. Prioritize project export after the core workflow is complete. Keep voice/image features deferred and modular.

## Sources

- [Next.js App Router installation](https://nextjs.org/docs/app/getting-started/installation)
- [shadcn/ui Next.js setup](https://ui.shadcn.com/docs/installation/next)
- [tscircuit documentation](https://docs.tscircuit.com/)
- [tscircuit RunFrame React viewer](https://github.com/tscircuit/runframe)
- [Circuit JSON](https://github.com/tscircuit/circuit-json)
- [Fritzing project views](https://fritzing.org/learning/get-started/project-view)
- [Fritzing sketch format](https://github.com/fritzing/fritzing-app/wiki/2.2-Sketch-file-format)
- [Fritzing license FAQ](https://fritzing.org/faq)
- [KiCad symbol libraries](https://github.com/KiCad/kicad-symbols)
- [KiCad library licensing](https://www.kicad.org/libraries/license/)
- [Espressif KiCad libraries](https://github.com/espressif/kicad-libraries)
- [Gemma 4 documentation](https://ai.google.dev/gemma/docs/core)
- [Gemma 4 model IDs in the Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API key security](https://ai.google.dev/gemini-api/docs/api-key)
- [Web Speech Recognition API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [Wokwi ESP32 simulation](https://docs.wokwi.com/guides/esp32)
