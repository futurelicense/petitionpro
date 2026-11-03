import { limitedJson } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { groqJson, groqModel, isGroqConfigured } from "@/lib/groq";
import { asString, asStringArray, fail } from "@/lib/http";
import { endeavorSystem, endeavorUser } from "@/lib/prompts";
import type { EndeavorId, EndeavorOption, Intake, RoleType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROLES: RoleType[] = ["researcher", "entrepreneur", "practitioner"];
const IDS: EndeavorId[] = ["conservative", "core", "stretch"];

export async function POST(req: Request) {
  try {
    if (!isGroqConfigured()) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured on the server." },
        { status: 503 }
      );
    }

    const body = (await limitedJson(req)) as Partial<Intake>;
    const intake: Intake = {
      domain: asString(body.domain),
      problem: asString(body.problem),
      mechanism: asString(body.mechanism),
      beneficiaries: asString(body.beneficiaries),
      roleType: ROLES.includes(body.roleType as RoleType)
        ? (body.roleType as RoleType)
        : "researcher",
      progress: asString(body.progress),
    };

    if (!intake.domain || !intake.problem || !intake.mechanism || !intake.beneficiaries) {
      return NextResponse.json(
        { error: "Domain, problem, mechanism, and U.S. beneficiaries are required." },
        { status: 400 }
      );
    }

    const raw = await groqJson<{ options?: unknown; warnings?: unknown }>({
      messages: [
        { role: "system", content: endeavorSystem },
        { role: "user", content: endeavorUser(intake) },
      ],
      model: groqModel(),
      temperature: 0.35,
      maxTokens: 1600,
    });

    const options = normalizeOptions(raw.options);
    if (options.length < 2) {
      return NextResponse.json(
        { error: "The model did not return enough endeavor options. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      options,
      warnings: asStringArray(raw.warnings),
    });
  } catch (error) {
    return fail(error);
  }
}

function normalizeOptions(raw: unknown): EndeavorOption[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? Object.values(raw as Record<string, unknown>)
      : [];
  const out: EndeavorOption[] = [];
  for (const [i, item] of list.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const fallback = IDS[Math.min(i, 2)];
    const idRaw = asString(row.id) || asString(row.kind) || fallback;
    const id = IDS.includes(idRaw as EndeavorId) ? (idRaw as EndeavorId) : fallback;
    const sentence =
      asString(row.sentence) || asString(row.proposedEndeavor) || asString(row.endeavor);
    const description =
      asString(row.description) || asString(row.summary) || asString(row.details);
    if (!sentence) continue;
    out.push({
      id,
      label: asString(row.label) || id,
      sentence,
      description: description || sentence,
      nationalImportanceFrame:
        asString(row.nationalImportanceFrame) || asString(row.national_importance) || "",
    });
  }
  const seen = new Set<string>();
  return out.filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}
