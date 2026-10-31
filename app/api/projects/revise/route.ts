import { NextResponse } from "next/server";
import { AiRequest, getProjectProvider } from "@/lib/ai/provider";

export async function POST(request: Request) {
  const raw = await request.json().catch(() => null);
  const parsed = AiRequest.revision.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Send a valid project and a revision request." }, { status: 400 });

  try {
    const result = await getProjectProvider().revise(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Project revision failed.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
