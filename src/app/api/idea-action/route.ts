import { NextResponse } from "next/server";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asString, fail } from "@/lib/http";
import { ideaActionSystem, ideaActionUser } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type Reading = { insight?: string; recommendation?: string; suggestion?: string };

export async function POST(request: Request) {
  try {
    if (!isGroqConfigured()) {
      return NextResponse.json({ error: "GROQ_API_KEY is not configured on the server." }, { status: 503 });
    }
    const body = (await request.json()) as { note?: string; brief?: string };
    const note = asString(body.note).slice(0, 6000);
    const brief = asString(body.brief).slice(0, 4000);
    if (note.length < 12 || brief.length < 12) {
      return NextResponse.json({ error: "The note and the case file are both required." }, { status: 400 });
    }
    const reading = await groqJson<Reading>({
      model: groqModel(),
      temperature: 0.2,
      messages: [
        { role: "system", content: ideaActionSystem },
        { role: "user", content: ideaActionUser(note, brief) },
      ],
    });
    const insight = asString(reading.insight);
    const recommendation = asString(reading.recommendation);
    const suggestion = asString(reading.suggestion);
    if (!insight || !recommendation || !suggestion) {
      return NextResponse.json({ error: "The reading did not come back complete. Try the note again." }, { status: 502 });
    }
    return NextResponse.json({ insight, recommendation, suggestion });
  } catch (error) {
    return fail(error);
  }
}
