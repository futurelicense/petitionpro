import { NextResponse } from "next/server";
import { withCheckedProgress } from "@/lib/framework";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asString, asStringArray, fail } from "@/lib/http";
import { fitSystem, fitUser } from "@/lib/prompts";
import type { CvRecord, FitChoice } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHOICES: FitChoice[] = ["keep", "narrow", "pivot"];

export async function POST(req: Request) {
  try {
    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 503 }
      );
    }

    const body = (await req.json()) as {
      sentence?: string;
      description?: string;
      niFrame?: string;
      record?: CvRecord;
      cvText?: string;
    };

    const sentence = asString(body.sentence);
    const description = asString(body.description);
    const niFrame = asString(body.niFrame);
    const record = body.record
      ? withCheckedProgress(body.record, asString(body.cvText))
      : undefined;
    if (!sentence || !description || !record) {
      return NextResponse.json(
        { error: "Endeavor and parsed CV record are required." },
        { status: 400 }
      );
    }

    const raw = await groqJson<Record<string, unknown>>({
      messages: [
        { role: "system", content: fitSystem },
        {
          role: "user",
          content: fitUser({
            sentence,
            description,
            niFrame,
            record,
          }),
        },
      ],
      json: true,
      model: groqModel(),
      temperature: 0.1,
      maxTokens: 1800,
    });

    const recommended = CHOICES.includes(asString(raw.recommended) as FitChoice)
      ? (asString(raw.recommended) as FitChoice)
      : "narrow";

    return NextResponse.json({
      recommended,
      rationale: asString(raw.rationale),
      narrowedSentence: asString(raw.narrowedSentence) || sentence,
      pivotSentence: asString(raw.pivotSentence) || sentence,
      missingExhibits: asStringArray(raw.missingExhibits),
      recordFitNotes: asStringArray(raw.recordFitNotes),
    });
  } catch (error) {
    return fail(error);
  }
}
