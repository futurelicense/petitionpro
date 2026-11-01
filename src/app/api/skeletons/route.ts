import { NextResponse } from "next/server";
import { quoteFoundInCv, withCheckedProgress } from "@/lib/framework";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asBool, asString, asStringArray, fail } from "@/lib/http";
import { clipText, redactPii } from "@/lib/pii";
import { eb1aDraftSystem, eb1aDraftUser, skeletonsSystem, skeletonsUser } from "@/lib/prompts";
import { checkCriteria } from "@/lib/tracks";
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
      track?: string;
      area?: string;
      continueWork?: string;
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

    if (body.track === "eb1a") return await draftEb1a(body);

    const choice = CHOICES.includes(body.choice as FitChoice)
      ? (body.choice as FitChoice)
      : null;
    if (!choice || !asString(body.sentence) || !body.record) {
      return NextResponse.json(
        { error: "Fit choice, endeavor, and CV record are required." },
        { status: 400 }
      );
    }

    const cvText = asString(body.cvText);
    const record = withCheckedProgress(body.record, cvText);
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
            record,
            cvExcerpt: clipText(redactPii(cvText), 8000),
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

async function draftEb1a(body: {
  area?: string;
  continueWork?: string;
  record?: CvRecord;
  cvText?: string;
}) {
  const area = asString(body.area);
  if (area.length < 8 || !body.record) {
    return NextResponse.json(
      { error: "Field and parsed CV record are required." },
      { status: 400 }
    );
  }
  const cvText = asString(body.cvText);
  const criteria = checkCriteria(body.record.extraordinaryAbility, cvText);
  const quotes = criteria
    .map((item) => `- ${item.criterion}: inCv=${item.inCv} quote: ${item.cvSpan}`)
    .join("\n");
  const raw = await groqJson<Record<string, unknown>>({
    messages: [
      { role: "system", content: eb1aDraftSystem },
      {
        role: "user",
        content: eb1aDraftUser({
          area,
          continueWork: asString(body.continueWork),
          quotes,
          cvExcerpt: clipText(redactPii(cvText), 8000),
        }),
      },
    ],
    json: true,
    model: groqModel(),
    temperature: 0.25,
    maxTokens: 3500,
  });
  const draft = asDraft(raw);
  return NextResponse.json({
    area,
    paragraphs: draft.paragraphs,
    claimedFacts: draft.claimedFacts.map((fact) => ({
      ...fact,
      supported: quoteFoundInCv(cvText, fact.cvSpan),
    })),
    gaps: asStringArray(raw.gaps),
  });
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
