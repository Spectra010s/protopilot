# ProtoPilot assistant

The workbench sends each user turn to `POST /api/assistant`. The request includes the current design, a conversation ID, and recent text messages. Gemma streams ordinary text into the chat. It calls a tool only when the user asks for an action the app supports.

## Tools

| Tool | Effect |
| --- | --- |
| `saveDesign` | Creates or updates the current design from a compact plan. The server expands and validates it, preserves the project ID, increments its revision on updates, and emits a circuit diagram card. |
| `showCircuitDiagram` | Adds the current breadboard/circuit diagram to chat. |
| `showSchematic` | Adds the current schematic to chat. |
| `showCode` | Adds the current Arduino firmware to chat. |

Questions such as “who are you?” or “why is there a diode?” should receive text without a tool call. The active design and conversation remain intact. The model sees the current design and the last 20 text turns.

## Stream contract

The response is newline-delimited JSON (`application/x-ndjson`). Events are:

- `text` with `delta`: append to the assistant's visible reply.
- `status` with `message`: show progress while a tool runs.
- `project` with `project`: validate and replace the active design in the client.
- `artifact` with `kind` (`breadboard`, `schematic`, or `code`) and a project snapshot: add an expandable result card to chat. Code is read from the snapshot's `firmware` field.
- `done`: response completed.
- `error` with `error`: show the failure without replacing the active design.

The workbench stores text and artifact messages in IndexedDB by project ID. Artifacts contain a project snapshot so an older chat result still shows the design from that turn. A new blank conversation receives its own ID; the first design created in it uses that same ID. The current design remains saved separately as a draft.

## Current boundary

The assistant's actions are limited to the design model and its existing visualizations. `saveDesign` replaces the full design from a compact plan rather than applying a component-level patch. A new design must contain usable connections; invalid plans return an error and leave the current draft in place.
