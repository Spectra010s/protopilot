import { NextResponse } from "next/server";
import { AiRequest, getProjectProvider } from "@/lib/ai/provider";
import { expandProject } from "@/lib/ai/compact-project";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = AiRequest.generation.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Add a project description of at least 8 characters." }, { status: 400 });

  try {
    const result = getProjectProvider().streamGenerate(parsed.data);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        try {
          send({ type: "status", message: "Gemma is designing your circuit." });
          let lastProgress = "";
          for await (const partial of result.partialOutputStream) {
            const title = partial.title;
            const count = partial.components?.length ?? 0;
            const message = title ? `Designing ${title}${count ? ` · ${count} components` : ""}` : count ? `Designing ${count} components` : "";
            if (message && message !== lastProgress) {
              send({ type: "status", message });
              lastProgress = message;
            }
          }
          const output = await result.output;
          send({ type: "result", project: expandProject(output, parsed.data.prompt, parsed.data.projectId), questions: [] });
        } catch (error) {
          send({ type: "error", error: error instanceof Error ? error.message : "Project generation failed." });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project generation failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
