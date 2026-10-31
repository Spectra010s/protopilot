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
  firmwareSource: z.string().optional().default(""),
  buildSteps: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

export type CompactProject = z.infer<typeof CompactProjectSchema>;

export function expandProject(plan: CompactProject, prompt: string, projectId?: string, existingProject?: Project | null): Project {
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

  function getComp(index: number) {
    if (components[index]) return components[index];
    if (index > 0 && components[index - 1]) return components[index - 1];
    return components[0];
  }

  function ensurePin(comp: typeof components[number], pinId: string) {
    const existing = comp.pins.find((p) => p.id.toLowerCase() === pinId.toLowerCase());
    if (existing) return existing.id;
    const isGround = /gnd|ground/i.test(pinId);
    const isPower = /vcc|power|5v|3v|vin/i.test(pinId);
    comp.pins.push({
      id: pinId,
      label: pinId.toUpperCase(),
      kind: isGround ? "ground" : isPower ? "power" : "digital",
      direction: isGround ? "passive" : "bidirectional",
      voltageMin: null,
      voltageMax: null,
      capabilities: [],
    });
    return pinId;
  }

  const connections = (plan.connections || []).flatMap((wire, index) => {
    const from = getComp(wire.fromComponent);
    const to = getComp(wire.toComponent);
    if (!from || !to || from.id === to.id) return [];
    const fromPinId = ensurePin(from, wire.fromPin);
    const toPinId = ensurePin(to, wire.toPin);
    return [{
      id: `wire-${index + 1}`,
      from: { componentId: from.id, pinId: fromPinId },
      to: { componentId: to.id, pinId: toPinId },
      net: wire.net || "NET",
      color: /gnd|ground/i.test(wire.net) ? "black" as const : /vcc|power|5v|3v/i.test(wire.net) ? "red" as const : "blue" as const,
      details: `${from.name} ${fromPinId} to ${to.name} ${toPinId}.`,
    }];
  });

  // Fallback: If no connections were resolved, connect common ground between controller and components
  if (!connections.length && components.length > 1) {
    const controller = components.find((c) => c.category === "controller") ?? components[0];
    const ctrlGnd = ensurePin(controller, "GND");
    components.forEach((comp) => {
      if (comp.id === controller.id) return;
      const compGnd = ensurePin(comp, "GND");
      connections.push({
        id: `wire-${connections.length + 1}`,
        from: { componentId: controller.id, pinId: ctrlGnd },
        to: { componentId: comp.id, pinId: compGnd },
        net: "GND",
        color: "black",
        details: `Common ground between ${controller.name} and ${comp.name}.`,
      });
    });
  }

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
    firmware: {
      board: components.find((component) => component.category === "controller")?.name ?? existingProject?.firmware.board ?? "Select a controller",
      language: "Arduino C++",
      filename: `${slug}.ino`,
      source: plan.firmwareSource || existingProject?.firmware.source || "",
    },
    buildSteps: plan.buildSteps,
    assumptions: ["Exact part numbers and electrical ratings must be confirmed before assembly."],
    warnings: [...plan.warnings, ...(connections.length < plan.connections.length ? ["Some generated connections referred to missing pins and were omitted."] : [])],
    clarificationQuestions: [],
  });
}
