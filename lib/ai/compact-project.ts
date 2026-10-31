import { z } from "zod";
import { createId } from "@/lib/id";
import { ProjectSchema, type Project } from "@/lib/project/schema";

const Category = z.enum(["controller", "sensor", "driver", "load", "protection", "power", "input", "indicator"]);
const PinKind = z.enum(["power", "ground", "analog", "digital", "switch", "load"]);

export const CompactProjectSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  components: z.array(z.object({
    name: z.string().min(1),
    category: Category,
    pins: z.array(z.object({ id: z.string().min(1), kind: PinKind })).min(1),
  })).min(1),
  connections: z.array(z.object({
    fromComponent: z.number().int().nonnegative(),
    fromPin: z.string().min(1),
    toComponent: z.number().int().nonnegative(),
    toPin: z.string().min(1),
    net: z.string().min(1),
  })).min(1),
  firmwareSource: z.string().min(1),
  buildSteps: z.array(z.string()),
  warnings: z.array(z.string()),
});

export type CompactProject = z.infer<typeof CompactProjectSchema>;

export function expandProject(plan: CompactProject, prompt: string, projectId?: string): Project {
  const components = plan.components.map((component, index) => ({
    id: `part-${index + 1}`,
    partId: component.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `part-${index + 1}`,
    reference: `${component.category === "controller" ? "U" : component.category === "sensor" ? "S" : component.category === "power" ? "P" : "X"}${index + 1}`,
    name: component.name,
    category: component.category,
    description: `${component.name}; confirm the exact part and ratings before assembly.`,
    pins: component.pins.map((pin) => ({
      id: pin.id,
      label: pin.id.toUpperCase(),
      kind: pin.kind,
      direction: pin.kind === "ground" ? "passive" as const : pin.kind === "load" ? "bidirectional" as const : "bidirectional" as const,
      voltageMin: null,
      voltageMax: null,
      capabilities: [],
    })),
    specifications: [{ key: "exactPartAndRatings", value: null, status: "unknown" as const }],
    layout: { x: 60 + (index % 3) * 210, y: 60 + Math.floor(index / 3) * 160 },
  }));

  const connections = plan.connections.flatMap((wire, index) => {
    const from = components[wire.fromComponent];
    const to = components[wire.toComponent];
    if (!from?.pins.some((pin) => pin.id === wire.fromPin) || !to?.pins.some((pin) => pin.id === wire.toPin)) return [];
    return [{
      id: `wire-${index + 1}`,
      from: { componentId: from.id, pinId: wire.fromPin },
      to: { componentId: to.id, pinId: wire.toPin },
      net: wire.net,
      color: /gnd|ground/i.test(wire.net) ? "black" as const : /vcc|power|5v|3v/i.test(wire.net) ? "red" as const : "blue" as const,
      details: `${from.name} ${wire.fromPin} to ${to.name} ${wire.toPin}.`,
    }];
  });
  if (!connections.length) throw new Error("Gemma returned no usable pin connections. Please retry the design.");

  const slug = plan.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "circuit";
  return ProjectSchema.parse({
    schemaVersion: 1,
    id: projectId ?? createId(),
    revision: 0,
    title: plan.title,
    prompt,
    summary: plan.summary,
    operatingPrinciple: plan.summary,
    constraints: { available: [], requirements: [] },
    components,
    connections,
    powerDomains: [],
    firmware: { board: components.find((component) => component.category === "controller")?.name ?? "Select a controller", language: "Arduino C++", filename: `${slug}.ino`, source: plan.firmwareSource },
    buildSteps: plan.buildSteps,
    assumptions: ["Exact part numbers and electrical ratings must be confirmed before assembly."],
    warnings: [...plan.warnings, ...(connections.length < plan.connections.length ? ["Some generated connections referred to missing pins and were omitted."] : [])],
    clarificationQuestions: [],
  });
}
