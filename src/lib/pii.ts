const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const SSN_PLAIN = /\b\d{9}\b/g;
const PASSPORT = /\b[A-Z]{1,2}\d{6,9}\b/g;

export function redactPii(text: string): string {
  return text
    .replace(SSN, "[redacted-ssn]")
    .replace(SSN_PLAIN, (m) => (m.startsWith("19") || m.startsWith("20") ? m : "[redacted-id]"))
    .replace(PASSPORT, "[redacted-id]")
    .replace(/\u0000/g, "");
}

export function clipText(text: string, maxChars = 14000): string {
  const trimmed = text.replace(/\s+\n/g, "\n").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars)}\n\n[truncated]`;
}
