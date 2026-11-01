import { todayISO } from "./cases";

export const REQUESTS_STORAGE = "petitionpro-requests-v1";

export type RequestStatus = "open" | "underway" | "done";

export type CaseRequest = {
  id: string;
  caseId: string;
  caseName: string;
  act: string;
  detail: string;
  openedOn: string;
  dueOn: string;
  doneOn: string;
  status: RequestStatus;
  createdAt: string;
};

export function createRequest(input: {
  caseId: string;
  caseName: string;
  act: string;
  detail: string;
  openedOn: string;
  dueOn: string;
}): CaseRequest {
  return {
    id: crypto.randomUUID(),
    caseId: input.caseId,
    caseName: input.caseName.trim(),
    act: input.act.trim(),
    detail: input.detail.trim(),
    openedOn: input.openedOn,
    dueOn: input.dueOn,
    doneOn: "",
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

export function requestOverdue(item: CaseRequest, today = todayISO()): boolean {
  return item.status !== "done" && Boolean(item.dueOn) && item.dueOn < today;
}

export function advanceRequest(item: CaseRequest, status: RequestStatus): CaseRequest {
  if (status === "done") return { ...item, status, doneOn: item.doneOn || todayISO() };
  return { ...item, status, doneOn: "" };
}

export function loadRequests(): CaseRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REQUESTS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CaseRequest[];
    return Array.isArray(parsed) ? parsed.map((item) => ({ ...item, detail: item.detail ?? "", doneOn: item.doneOn ?? "" })) : [];
  } catch {
    return [];
  }
}

export function saveRequests(items: CaseRequest[]) {
  localStorage.setItem(REQUESTS_STORAGE, JSON.stringify(items));
}

export function requestsForCase(caseId: string): CaseRequest[] {
  return sortRequests(loadRequests().filter((item) => item.caseId === caseId));
}

export function sortRequests(items: CaseRequest[], today = todayISO()): CaseRequest[] {
  return [...items].sort((a, b) => {
    const rank = (item: CaseRequest) => (item.status === "done" ? 2 : requestOverdue(item, today) ? 0 : 1);
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.dueOn.localeCompare(b.dueOn) || a.act.localeCompare(b.act);
  });
}

export function removeRequest(id: string) {
  saveRequests(loadRequests().filter((item) => item.id !== id));
}
