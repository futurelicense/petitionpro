export type InquiryStatus = "new" | "reviewed" | "converted";
export type EmailStatus = "pending" | "not-configured" | "failed" | "accepted";

export type Inquiry = {
  id: string;
  createdAt: string;
  consentAt: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  endeavor: string;
  mechanism: string;
  beneficiaries: string;
  nationalImportance: string;
  cvText: string;
  cvFileName: string;
  cvType: string;
  report: string;
  status: InquiryStatus;
  emailStatus: EmailStatus;
  emailId: string;
};

export const FREE_STUDIO_STORAGE = "petitionpro-free-v1";
export const DIY_STORAGE = "petitionpro-diy-v1";
