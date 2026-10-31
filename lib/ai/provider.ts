import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { plantProject, updateConnection } from "@/lib/project/demo-project";
import { ProjectSchema, validateProject, type Project } from "@/lib/project/schema";

const GenerationRequestSchema = z.object({ prompt: z.string().trim().min(8).max(4000), constraints: z.object({ controller: z.string().optional(), available: z.array(z.string()).optional(), budget: z.string().optional(), requirements: z.array(z.string()).optional() }).optional() });
const RevisionRequestSchema = z.object({ project: ProjectSchema, request: z.string().trim().min(2).max(2000) });
const GenerationOutputSchema = z.object({ project: ProjectSchema.nullable(), questions: z.array(z.string()) });

export type GenerateRequest = z.infer<typeof GenerationRequestSchema>;
export type RevisionRequest = z.infer<typeof RevisionRequestSchema>;
export type GenerateResult = { project: Project | null; questions: string[]; mode: "mock" | "gemma" };
export type RevisionResult = { project: Project; message: string; mode: "mock" | "gemma" };

export const AiRequest = { generation: GenerationRequestSchema, revision: RevisionRequestSchema };

export interface ProjectProvider {
  generate(request: GenerateRequest): Promise<GenerateResult>;
  revise(request: RevisionRequest): Promise<RevisionResult>;
}

class MockProvider implements ProjectProvider {
  async generate({ prompt }: GenerateRequest): Promise<GenerateResult> {
    if (/plant|soil|water|watering|moisture|pump/i.test(prompt)) {
      const project = validateProject({ ...plantProject, id: `plant-${crypto.randomUUID()}`, revision: 0, prompt });
      return { project, questions: [], mode: "mock" };
    }
    return {
      project: null,
      questions: [
        "Which controller should the design use (ESP32, Arduino Uno, or another board)?",
        "What should the device sense or control, and what parts do you already have?",
      ],
      mode: "mock",
    };
  }

  async revise({ project, request }: RevisionRequest): Promise<RevisionResult> {
    const pinRequest = request.match(/(?:moisture|sensor|analog|adc).{0,50}gpio\s*(34|35)|gpio\s*(34|35).{0,50}(?:moisture|sensor|analog|adc)/i);
    const chosenPin = pinRequest?.[1] ?? pinRequest?.[2];
    if (chosenPin && project.connections.some((connection) => connection.id === "c3")) {
      const updated = updateConnection(project, "c3", `gpio${chosenPin}`);
      const source = updated.firmware.source.replace(/MOISTURE_PIN\s*=\s*\d+/, `MOISTURE_PIN = ${chosenPin}`);
      return {
        project: validateProject({ ...updated, firmware: { ...updated.firmware, source } }),
        message: `Moved the moisture input to GPIO${chosenPin}. The schematic, breadboard, wiring table, and firmware use the updated pin.`,
        mode: "mock",
      };
    }

    if (/why|explain|purpose/i.test(request)) {
      return { project, message: "The MOSFET switches the pump current from its external supply. The ESP32 GPIO only controls the MOSFET gate, and the diode limits the pump's inductive voltage spike.", mode: "mock" };
    }

    return {
      project,
      message: "The mock provider can demonstrate changing the moisture input between GPIO34 and GPIO35, or explain the pump driver. Configure Gemma for general design revisions.",
      mode: "mock",
    };
  }
}

class GemmaProvider implements ProjectProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  private async askJson(prompt: string) {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: { responseMimeType: "application/json", temperature: 0.2 },
    });
    if (!response.text) throw new Error("Gemma returned an empty response.");
    try {
      return JSON.parse(response.text) as unknown;
    } catch {
      const first = response.text.indexOf("{");
      const last = response.text.lastIndexOf("}");
      if (first < 0 || last <= first) throw new Error("Gemma returned malformed JSON.");
      return JSON.parse(response.text.slice(first, last + 1)) as unknown;
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const output = await this.askJson(`You are an electronics design assistant. Return only a JSON object with exactly two top-level fields: "project" (a complete project object matching the schema below, or null while clarification is needed) and "questions" (an array of targeted strings). Do not invent component ratings. Use status "unknown" when exact ratings are not known. Every project must include schemaVersion 1, id, revision, title, prompt, summary, operatingPrinciple, constraints, components with pin identifiers and specs, connections, powerDomains, firmware, buildSteps, assumptions, warnings, and clarificationQuestions. Never connect a pump or motor directly to a microcontroller GPIO. Include a switching driver, flyback protection for inductive DC loads, external load supply, and shared ground where needed. Ask questions and set project to null when a safe meaningful design needs missing facts. Make assumptions explicit. Ensure each connection references a real component and pin. Output JavaScript/Arduino firmware appropriate to the chosen board.

USER REQUEST:
${request.prompt}

OPTIONAL CONSTRAINTS:
${JSON.stringify(request.constraints ?? {})}

JSON SHAPE EXAMPLE:
{"project":null,"questions":["Which exact pump voltage and startup current are printed on its label?"]}`);
    const parsed = GenerationOutputSchema.safeParse(output);
    if (!parsed.success) throw new Error(`Gemma response failed schema validation: ${parsed.error.issues.slice(0, 3).map((issue) => issue.message).join("; ")}`);
    return { ...parsed.data, mode: "gemma" };
  }

  async revise({ project, request }: RevisionRequest): Promise<RevisionResult> {
    const output = await this.askJson(`Revise this electronics project according to the requested change. Return only a JSON object with "project" containing the complete revised project and "message" containing a short explanation. Keep schemaVersion 1. Increment revision. Preserve unknown/assumed electrical ratings unless the user supplies exact datasheet values. Keep all pins and connections internally consistent. Never drive a pump/motor directly from a controller GPIO. The UI derives diagrams, wiring, and checks directly from this project, so update the structured data, firmware, assumptions and warnings as needed.

CURRENT PROJECT:
${JSON.stringify(project)}

USER CHANGE:
${request}`);
    const resultSchema = z.object({ project: ProjectSchema, message: z.string().min(1) });
    const parsed = resultSchema.safeParse(output);
    if (!parsed.success) throw new Error(`Gemma revision failed schema validation: ${parsed.error.issues.slice(0, 3).map((issue) => issue.message).join("; ")}`);
    return { ...parsed.data, mode: "gemma" };
  }
}

export function getProjectProvider(): ProjectProvider {
  const provider = process.env.AI_PROVIDER ?? "mock";
  if (provider === "mock") return new MockProvider();
  if (provider !== "gemma") throw new Error(`Unsupported AI_PROVIDER: ${provider}`);
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMMA_MODEL;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemma.");
  if (!model) throw new Error("GEMMA_MODEL is required when AI_PROVIDER=gemma.");
  return new GemmaProvider(apiKey, model);
}
