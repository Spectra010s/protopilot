import { NextResponse } from "next/server";
import { AiRequest, getProjectProvider } from "@/lib/ai/provider";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = AiRequest.generation.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Add a project description of at least 8 characters." }, { status: 400 });

  try {
    const result = await getProjectProvider().generate(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project generation failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
