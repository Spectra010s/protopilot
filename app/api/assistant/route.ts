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
          instructions: `You are ProtoPilot, an electronics design assistant. Talk naturally with the user and remember the conversation. Answer questions directly. Use saveDesign only when the user asks you to build or change the circuit design; it updates components, wiring, schematic data, and Arduino firmware. Use showCircuitDiagram, showSchematic, or showCode when the user asks to see that view. Questions and conversation need no tool. If a design is already open, preserve useful parts when changing it. Never drive a motor or pump directly from GPIO; use an appropriate driver and flyback protection, and mark unknown electrical ratings as unknown. After using a tool, briefly tell the user what you did.\nCURRENT DESIGN:\n${project ? JSON.stringify(project) : "No design is open."}`,
          messages,
          tools: {
            saveDesign: tool({
              description: "Create or update the current hardware design, including components, schematic connections, build steps, and Arduino firmware. Use only for a request to build or modify the design.",
              inputSchema: CompactProjectSchema,
              execute: async (plan) => {
                const next = expandProject(plan, project?.prompt ?? message, projectId);
                savedProject = { ...next, revision: project ? project.revision + 1 : 0 };
                send({ type: "project", project: savedProject });
                return { title: savedProject.title, revision: savedProject.revision, components: savedProject.components.length };
              },
            }),
            showCircuitDiagram: tool({
              description: "Show the current project's circuit diagram or breadboard view.",
              inputSchema: z.object({}),
              execute: async () => {
                if (!project && !savedProject) return { available: false, reason: "No design is open." };
                send({ type: "view", view: "breadboard" });
                return { available: true, view: "circuit diagram" };
              },
            }),
            showSchematic: tool({
              description: "Show the current project's electrical schematic view.",
              inputSchema: z.object({}),
              execute: async () => {
                if (!project && !savedProject) return { available: false, reason: "No design is open." };
                send({ type: "view", view: "schematic" });
                return { available: true, view: "schematic" };
              },
            }),
            showCode: tool({
              description: "Show the current project's generated Arduino firmware code panel.",
              inputSchema: z.object({}),
              execute: async () => {
                if (!project && !savedProject) return { available: false, reason: "No design is open." };
                send({ type: "view", view: "code" });
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
