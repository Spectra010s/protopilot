import { z } from "zod";

export const PROJECT_SCHEMA_VERSION = 1;

export const PinSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(["power", "ground", "analog", "digital", "switch", "load"]),
  direction: z.enum(["in", "out", "bidirectional", "passive"]),
  voltageMin: z.number().nullable(),
  voltageMax: z.number().nullable(),
  capabilities: z.array(z.string()),
});

export const EndpointSchema = z.object({ componentId: z.string().min(1), pinId: z.string().min(1) });

export const ComponentSchema = z.object({
  id: z.string().min(1),
  partId: z.string().min(1),
  reference: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["controller", "sensor", "driver", "load", "protection", "power", "input", "indicator"]),
  description: z.string(),
  pins: z.array(PinSchema).min(1),
  specifications: z.array(z.object({
    key: z.string(), value: z.union([z.string(), z.number(), z.null()]), unit: z.string().optional(),
    status: z.enum(["verified", "assumed", "unknown"]), source: z.string().optional(),
  })),
  layout: z.object({ x: z.number(), y: z.number() }),
});

export const ConnectionSchema = z.object({
  id: z.string().min(1),
  from: EndpointSchema,
  to: EndpointSchema,
  net: z.string(),
  color: z.enum(["red", "black", "yellow", "blue", "green", "white"]),
  details: z.string(),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
  id: z.string().min(1),
  revision: z.number().int().nonnegative(),
  title: z.string().min(1),
  prompt: z.string(),
  summary: z.string(),
  operatingPrinciple: z.string(),
  constraints: z.object({ controller: z.string().optional(), budget: z.string().optional(), available: z.array(z.string()), requirements: z.array(z.string()) }),
  components: z.array(ComponentSchema).min(1),
  connections: z.array(ConnectionSchema),
  powerDomains: z.array(z.object({ id: z.string(), voltage: z.number().nullable(), currentMax: z.number().nullable(), source: z.string(), groundReference: z.string().optional() })),
  firmware: z.object({ board: z.string(), language: z.string(), filename: z.string(), source: z.string() }),
  buildSteps: z.array(z.string()),
  assumptions: z.array(z.string()),
  warnings: z.array(z.string()),
  clarificationQuestions: z.array(z.string()),
});

export type Pin = z.infer<typeof PinSchema>;
export type Endpoint = z.infer<typeof EndpointSchema>;
export type Component = z.infer<typeof ComponentSchema>;
export type Connection = z.infer<typeof ConnectionSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export function validateProject(value: unknown): Project {
  return ProjectSchema.parse(value);
}
