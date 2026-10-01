import { NextResponse } from "next/server";
import { extractCvText } from "@/lib/extract";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asString, asStringArray, fail } from "@/lib/http";
import { clipText, redactPii } from "@/lib/pii";
import { parseSystem, parseUser } from "@/lib/prompts";
import type { CvRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 503 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const pasted = asString(form.get("cvText"));
    const endeavorSentence = asString(form.get("endeavorSentence"));
    if (!endeavorSentence) {
      return NextResponse.json(
        { error: "Generate a proposed endeavor before uploading a CV." },
        { status: 400 }
      );
    }

    let cvText = "";
    if (file instanceof File && file.size > 0) {
      if (file.size > 6 * 1024 * 1024) {
        return NextResponse.json({ error: "CV must be 6 MB or smaller." }, { status: 400 });
      }
      cvText = await extractCvText(file);
    } else if (pasted.replace(/\s/g, "").length >= 80) {
      cvText = clipText(redactPii(pasted));
    } else {
      return NextResponse.json(
        { error: "Attach a CV file or paste at least a short CV." },
        { status: 400 }
      );
    }
    const raw = await groqJson<Record<string, unknown>>({
      messages: [
        { role: "system", content: parseSystem },
        { role: "user", content: parseUser(cvText, endeavorSentence) },
      ],
      json: true,
      model: groqModel(),
      temperature: 0.05,
      maxTokens: 2200,
    });

    const record: CvRecord = {
      degrees: Array.isArray(raw.degrees)
        ? raw.degrees.flatMap((d) => {
            if (!d || typeof d !== "object") return [];
            const row = d as Record<string, unknown>;
            return [
              {
                degree: asString(row.degree),
                field: asString(row.field),
                institution: asString(row.institution),
                year: asString(row.year),
              },
            ];
          })
        : [],
      occupation: asString(raw.occupation),
      yearsExperience: asString(raw.yearsExperience),
      projects: Array.isArray(raw.projects)
        ? raw.projects.flatMap((p) => {
            if (!p || typeof p !== "object") return [];
            const row = p as Record<string, unknown>;
            const title = asString(row.title);
            const summary = asString(row.summary);
            if (!title && !summary) return [];
            return [{ title, summary }];
          })
        : [],
      publications: asStringArray(raw.publications),
      patents: asStringArray(raw.patents),
      grantsOrFunding: asStringArray(raw.grantsOrFunding),
      leadership: asStringArray(raw.leadership),
      skills: asStringArray(raw.skills),
      progressTowardEndeavor: asStringArray(raw.progressTowardEndeavor),
      gaps: asStringArray(raw.gaps),
    };

    return NextResponse.json({ record, cvText });
  } catch (error) {
    return fail(error);
  }
}
