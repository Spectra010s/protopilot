import { createGoogle } from "@ai-sdk/google";
import { stepCountIs, streamText, tool, type ModelMessage } from "ai";
import { z } from "zod";
import { CompactProjectSchema, expandProject } from "@/lib/ai/compact-project";
import { ProjectSchema, type Project } from "@/lib/project/schema";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(8000),
  projectId: z.string().min(1),
  project: ProjectSchema.nullable(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(30),
});

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ error: "Send a message and the current design context." }, { status: 400 });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "GEMINI_API_KEY is required." }, { status: 422 });

  const { message, projectId, project, history } = parsed.data;
  const encoder = new TextEncoder();
  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let savedProject: Project | null = null;
      let answer = "";
      try {
        const model = createGoogle({ apiKey })(process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it");
        const messages: ModelMessage[] = [
          ...history.slice(-20).map((item) => ({ role: item.role, content: item.content })),
          { role: "user", content: message },
        ];
        const result = streamText({
          model,
          instructions: `You are ProtoPilot, an AI electronics and hardware design assistant. Talk naturally, concisely, and directly with the user.
Use tools to generate and show hardware designs:
- When the user asks to design, build, or modify a hardware circuit: call saveDesign. It generates components, schematic connections, build steps, and Arduino firmware.
- When the user asks for code, firmware, or to write/modify the Arduino program: call showCode (if a design is open) or generateCode.
- When the user asks to see the circuit diagram, picture, or breadboard: call showCircuitDiagram.
- When the user asks to see the electrical schematic: call showSchematic.
- When the user asks general questions or discusses electronics: answer directly in markdown without calling tools.
CRITICAL DESIGN RULES:
- If the user's request is for a new, different device or circuit idea, create a completely fresh design from scratch with parts, microcontroller, and pinouts tailored specifically to their prompt. Do NOT carry over components from an unrelated previous design.
- Never drive an inductive load (motor, solenoid, relay, pump) directly from a GPIO pin; always require a MOSFET/transistor driver and flyback diode.
- Always provide a clear, helpful explanation of your decisions in your reply.\nCURRENT DESIGN:\n${project ? JSON.stringify(project) : "No design is open."}`,
          messages,
          tools: {
            saveDesign: tool({
              description: "Create or update the current hardware design, including components, schematic connections, build steps, and Arduino firmware. Use only for a request to build or modify the design.",
              inputSchema: CompactProjectSchema,
              execute: async (plan) => {
                const next = expandProject(plan, project?.prompt ?? message, projectId);
                savedProject = { ...next, revision: project ? project.revision + 1 : 0 };
                send({ type: "project", project: savedProject });

                const askedForCode = /\b(code|firmware|sketch|c\+\+|program|arduino|software)\b/i.test(message);
                const askedForCircuit = /\b(circuit|diagram|breadboard|schematic|wire|wiring|visual|picture|image|look like)\b/i.test(message);

                if (askedForCode && !askedForCircuit) {
                  send({ type: "artifact", kind: "code", project: savedProject });
                } else if (askedForCircuit && !askedForCode) {
                  send({ type: "artifact", kind: "breadboard", project: savedProject });
                } else {
                  send({ type: "artifact", kind: "breadboard", project: savedProject });
                  send({ type: "artifact", kind: "code", project: savedProject });
                }
                return { title: savedProject.title, revision: savedProject.revision, components: savedProject.components.length };
              },
            }),
            generateCode: tool({
              description: "Generate or revise Arduino C++ firmware code for the circuit design.",
              inputSchema: z.object({
                code: z.string().describe("Complete Arduino C++ source code with setup(), loop(), and comments."),
                filename: z.string().optional().describe("Filename e.g. main.ino"),
                board: z.string().optional().describe("Target board e.g. ESP32, Arduino Uno, Raspberry Pi Pico"),
              }),
              execute: async ({ code, filename, board }) => {
                const current = savedProject ?? project;
                if (!current) return { available: false, reason: "No design is open. Create a circuit design first." };
                const updated: Project = {
                  ...current,
                  revision: current.revision + 1,
                  firmware: {
                    ...current.firmware,
                    filename: filename ? (filename.endsWith(".ino") || filename.endsWith(".cpp") ? filename : `${filename}.ino`) : current.firmware.filename,
                    board: board ?? current.firmware.board,
                    source: code,
                  },
                };
                savedProject = updated;
                send({ type: "project", project: updated });
                send({ type: "artifact", kind: "code", project: updated });
                return { success: true, filename: updated.firmware.filename, lines: code.split("\n").length };
              },
            }),
            showCircuitDiagram: tool({
              description: "Show the current project's circuit diagram or breadboard view.",
              inputSchema: z.object({}),
              execute: async () => {
                const current = savedProject ?? project;
                if (!current) return { available: false, reason: "No design is open." };
                send({ type: "artifact", kind: "breadboard", project: current });
                return { available: true, view: "circuit diagram" };
              },
            }),
            showSchematic: tool({
              description: "Show the current project's electrical schematic view.",
              inputSchema: z.object({}),
              execute: async () => {
                const current = savedProject ?? project;
                if (!current) return { available: false, reason: "No design is open." };
                send({ type: "artifact", kind: "schematic", project: current });
                return { available: true, view: "schematic" };
              },
            }),
            showCode: tool({
              description: "Show the current project's generated Arduino firmware code panel.",
              inputSchema: z.object({}),
              execute: async () => {
                const current = savedProject ?? project;
                if (!current) return { available: false, reason: "No design is open." };
                send({ type: "artifact", kind: "code", project: current });
                return { available: true, view: "code" };
              },
            }),
          },
          stopWhen: stepCountIs(3),
          temperature: 0.2,
          maxOutputTokens: 8192,
          providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
        });
        for await (const part of result.stream) {
          if (part.type === "text-delta") {
            answer += part.text;
            send({ type: "text", delta: part.text });
          } else if (part.type === "tool-call") {
            send({ type: "status", message: "Updating the circuit design…" });
          } else if (part.type === "tool-error") {
            throw part.error;
          } else if (part.type === "error") {
            throw part.error;
          }
        }
        const projectTitle = (savedProject as Project | null)?.title;
        if (!answer.trim()) send({ type: "text", delta: projectTitle ? `Created ${projectTitle}.` : "I couldn't complete that response. Please try again." });
        send({ type: "done" });
      } catch (error) {
        send({ type: "error", error: error instanceof Error ? error.message : "ProtoPilot could not respond." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(responseStream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
