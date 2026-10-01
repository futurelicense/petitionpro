import mammoth from "mammoth";
import { clipText, redactPii } from "./pii";

async function extractPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const result = await extractText(pdf, { mergePages: true });
  const text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  return text || "";
}

export async function extractCvText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());

  let raw = "";
  if (type === "application/pdf" || name.endsWith(".pdf")) {
    raw = await extractPdf(buffer);
  } else if (
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const out = await mammoth.extractRawText({ buffer });
    raw = out.value;
  } else if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md")) {
    raw = buffer.toString("utf8");
  } else {
    throw new Error("Upload a PDF, DOCX, or plain-text CV.");
  }

  const text = clipText(redactPii(raw));
  if (text.replace(/\s/g, "").length < 80) {
    throw new Error(
      "Could not read enough text from that file. If it is a scanned PDF, export a text-based CV and try again."
    );
  }
  return text;
}
