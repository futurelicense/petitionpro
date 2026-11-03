import { createCase, type ClientCase } from "./cases";
import type { Inquiry } from "./inquiry-types";

/** An inquiry has one stable case ID, so reopening/importing never resets existing work. */
export function caseFromInquiry(inquiry: Inquiry, existing: ClientCase[]): ClientCase {
  const saved = existing.find((matter) => matter.id === inquiry.id || matter.sourceInquiryId === inquiry.id);
  if (saved) return saved;
  return { ...createCase({ name: inquiry.name, email: inquiry.email, phone: inquiry.phone, matterRef: `INQ-${inquiry.id.slice(0, 8)}` }),
    id: inquiry.id, sourceInquiryId: inquiry.id, assessmentReport: inquiry.report,
    endeavorSentence: inquiry.endeavor, mechanism: inquiry.mechanism, beneficiaries: inquiry.beneficiaries,
    niFrame: inquiry.nationalImportance, cvText: inquiry.cvText, cvFileName: inquiry.cvFileName,
    pathway: "eb2-niw", activePathway: "eb2-niw",
  };
}
