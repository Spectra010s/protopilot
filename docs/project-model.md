# Project model

`lib/project/schema.ts` is the canonical Zod schema. `schemaVersion` is currently `1`; a project has a stable `id` and a nonnegative `revision`. Components have named pins and ratings with `verified`, `assumed`, or `unknown` status. Connections refer to component IDs and pin IDs. The project also carries firmware, build steps, assumptions, warnings, and optional power-domain data.

## AI plan to project

Gemma's `saveDesign` tool accepts the smaller `CompactProjectSchema` in `lib/ai/compact-project.ts`: title, summary, components and connected pins, connections by component array index, firmware source, build steps, and warnings. `expandProject` adds IDs, references, layout positions, placeholder ratings, and a firmware filename, then parses the result with `ProjectSchema`.

On an update, the assistant route keeps the existing project ID and increments its revision. It replaces the project from a new compact plan. It does not apply a small patch to a single component. Invalid pin references in the plan are omitted; if no usable connection remains, expansion fails and the current design stays in place.

## Derived output and validation

- `deriveWiringTable` formats the canonical connections for the wiring table.
- `BreadboardView` and `SchematicView` draw SVGs from the same project data.
- `validateElectrical` checks referenced pins, direct GPIO-to-load links, driver and protection parts, common ground, unknown ratings, required pins, and a moisture-sensor ADC path.

Several checks were written for the original plant-watering demo. A valid design for another type of circuit can still receive irrelevant warnings or failures. Treat checks as prompts for review, not proof of electrical correctness. See [Privacy and hardware safety](privacy-and-safety.md).

When changing the project format, update the schema, compact-plan expansion, any saved-data migration, renderers, checks, and storage smoke test together. Do not silently reinterpret existing browser drafts.
