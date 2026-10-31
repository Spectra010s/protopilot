import { createGoogle } from "@ai-sdk/google";
import { generateText, streamText, Output } from "ai";
import { z } from "zod";
import { ProjectSchema, type Project } from "@/lib/project/schema";
import { CompactProjectSchema } from "@/lib/ai/compact-project";

const GenerationRequestSchema = z.object({ prompt: z.string().trim().min(8).max(8000), projectId: z.string().min(1).optional(), constraints: z.object({ controller: z.string().optional(), available: z.array(z.string()).optional(), budget: z.string().optional(), requirements: z.array(z.string()).optional() }).optional() });
const RevisionRequestSchema = z.object({ project: ProjectSchema, request: z.string().trim().min(2).max(2000) });
const GenerationOutputSchema = z.object({ project: ProjectSchema.nullable(), questions: z.array(z.string()) });
const DESIGN_INSTRUCTIONS = `You are ProtoPilot, an electronics design assistant. Create an editable and electrically cautious hardware design.
Never connect a pump, motor, or other load directly to a microcontroller GPIO. Use a suitable driver, flyback protection for inductive DC loads, the load's separate supply, and common ground where required. Keep water away from exposed electronics.
Do not invent exact component ratings. Use "unknown" status and add a warning when a part's exact rating is unknown. If an unknown rating can be resolved by selecting a correctly rated part later, continue the design with a clear requirement. Ask a clarification only when a missing fact prevents choosing a safe design. Never ask again for a value the user already supplied. Ask no more than two short, specific questions. Never say that a design is guaranteed safe or functional.
Every project must match the supplied schema, include valid component/pin references, a wiring-ready connection list, Arduino firmware, build steps, assumptions, and warnings.`;

export type GenerateRequest = z.infer<typeof GenerationRequestSchema>;
export type RevisionRequest = z.infer<typeof RevisionRequestSchema>;
export type GenerateResult = { project: Project | null; questions: string[] };
export type RevisionResult = { project: Project; message: string };

export const AiRequest = { generation: GenerationRequestSchema, revision: RevisionRequestSchema };

export interface ProjectProvider {
  generate(request: GenerateRequest): Promise<GenerateResult>;
  streamGenerate(request: GenerateRequest): ReturnType<GemmaProvider["streamGenerate"]>;
  revise(request: RevisionRequest): Promise<RevisionResult>;
}

class GemmaProvider implements ProjectProvider {
  private readonly model;

  constructor(apiKey: string, model: string) {
    this.model = createGoogle({ apiKey })(model);
  }

  private async askObject<T>(instructions: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
    const { output } = await generateText({
      model: this.model,
      instructions,
      prompt,
      output: Output.object({ schema }),
      temperature: 0.2,
      maxOutputTokens: 8192,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: "minimal" } },
      },
    });
    return output;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const output = await this.askObject(DESIGN_INSTRUCTIONS, `Always generate and return a complete "project" matching the schema. For any unstated voltages or part ratings, use standard assumptions (e.g. 5V supply, 3.3V logic) with status "assumed" or "unknown", and list them in the "assumptions" array. Only set "project" to null if the request is completely incomprehensible or non-hardware. "questions" can contain optional clarification questions or be empty.
USER REQUEST:
${request.prompt}

OPTIONAL CONSTRAINTS:
${JSON.stringify(request.constraints ?? {})}`, GenerationOutputSchema);
    return { ...output, project: output.project && request.projectId ? { ...output.project, id: request.projectId } : output.project };
  }

  streamGenerate(request: GenerateRequest) {
    return streamText({
      model: this.model,
      instructions: DESIGN_INSTRUCTIONS,
      prompt: `Reply to the user as ProtoPilot. If they want a hardware design, include a compact, wiring-ready project and a brief reply. For a question or conversation that does not request a new design, answer it and set project to null. For a project, use 3 to 8 components, include only connected pins, refer to components by zero-based array indexes, and keep firmware under 40 lines. Never connect a motor or pump directly to GPIO; include appropriate driver and protection. Do not invent confirmed ratings.\nUSER REQUEST:\n${request.prompt}\nOPTIONAL CONSTRAINTS:\n${JSON.stringify(request.constraints ?? {})}`,
      output: Output.object({ schema: z.object({ reply: z.string(), project: CompactProjectSchema.nullable() }) }),
      temperature: 0.2,
      maxOutputTokens: 8192,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
    });
  }

  async revise({ project, request }: RevisionRequest): Promise<RevisionResult> {
    const resultSchema = z.object({ project: ProjectSchema.nullable(), message: z.string().min(1) });
    const output = await this.askObject(`${DESIGN_INSTRUCTIONS}\nFor questions or conversation, answer in message and set project to null. Only return a complete revised project when the user asks to change the design. For revisions, keep schemaVersion 1, increment revision, preserve unknown/assumed values, and keep the project, firmware, connections, and component pins consistent.`, `Reply to the user in message. Include a revised project only if they requested a design change.
CURRENT PROJECT:
${JSON.stringify(project)}

USER CHANGE:
${request}`, resultSchema);
    return { project: output.project ? { ...output.project, id: project.id } : project, message: output.message };
  }
}

export function getProjectProvider(): ProjectProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to run the Gemma 4 assistant.");
  const model = process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it";
  return new GemmaProvider(apiKey, model);
}
