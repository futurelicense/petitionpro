import { NextResponse } from "next/server";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asBool, asString, asStringArray, fail } from "@/lib/http";
import { clipText, redactPii } from "@/lib/pii";
import { skeletonsSystem, skeletonsUser } from "@/lib/prompts";
import type { ClaimSpan, CvRecord, FitChoice, SkeletonDraft } from "@/lib/types";

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
      choice?: FitChoice;
      sentence?: string;
      description?: string;
      niFrame?: string;
      fitRationale?: string;
      narrowedSentence?: string;
      pivotSentence?: string;
      record?: CvRecord;
      cvText?: string;
    };

    const choice = CHOICES.includes(body.choice as FitChoice)
      ? (body.choice as FitChoice)
      : null;
    if (!choice || !asString(body.sentence) || !body.record) {
      return NextResponse.json(
        { error: "Fit choice, endeavor, and CV record are required." },
        { status: 400 }
      );
    }

    const raw = await groqJson<Record<string, unknown>>({
      messages: [
        { role: "system", content: skeletonsSystem },
        {
          role: "user",
          content: skeletonsUser({
            choice,
            sentence: asString(body.sentence),
            description: asString(body.description),
            niFrame: asString(body.niFrame),
            fitRationale: asString(body.fitRationale),
            narrowedSentence: asString(body.narrowedSentence),
            pivotSentence: asString(body.pivotSentence),
            record: body.record,
            cvExcerpt: clipText(redactPii(asString(body.cvText)), 8000),
          }),
        },
      ],
      json: true,
      model: groqModel(),
      temperature: 0.25,
      maxTokens: 3500,
    });

    const choiceWord = asString(raw.chosenSentence).toLowerCase();
    const chosenSentence =
      CHOICES.includes(choiceWord as FitChoice) || !asString(raw.chosenSentence)
        ? choice === "narrow"
          ? asString(body.narrowedSentence) || asString(body.sentence)
          : choice === "pivot"
            ? asString(body.pivotSentence) || asString(body.sentence)
            : asString(body.sentence)
        : asString(raw.chosenSentence);

    return NextResponse.json({
      chosenSentence,
      wellPositioning: asDraft(raw.wellPositioning),
      nationalImportance: asDraft(raw.nationalImportance),
      gaps: asStringArray(raw.gaps),
    });
  } catch (error) {
    return fail(error);
  }
}

function asDraft(raw: unknown): SkeletonDraft {
  if (!raw || typeof raw !== "object") {
    return { paragraphs: [], claimedFacts: [] };
  }
  const row = raw as Record<string, unknown>;
  const claimedFacts: ClaimSpan[] = Array.isArray(row.claimedFacts)
    ? row.claimedFacts.flatMap((c) => {
        if (!c || typeof c !== "object") return [];
        const item = c as Record<string, unknown>;
        const claim = asString(item.claim);
        if (!claim) return [];
        return [
          {
            claim,
            cvSpan: asString(item.cvSpan),
            supported: asBool(item.supported),
          },
        ];
      })
    : [];
  return {
    paragraphs: asStringArray(row.paragraphs),
    claimedFacts,
  };
}
