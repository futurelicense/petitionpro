import { InquiryError } from "./inquiries";

/** Limit streamed multipart bodies too, rather than trusting Content-Length. */
export async function limitedFormData(request: Request, limit = 7 * 1024 * 1024): Promise<FormData> {
  if (Number(request.headers.get("content-length")) > limit) throw new InquiryError("Upload must be 6 MB or smaller.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InquiryError("No form was submitted.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new InquiryError("Upload must be 6 MB or smaller.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
  } catch { throw new InquiryError("Submit a valid upload form."); }
}

export async function limitedJson(request: Request, limit = 256 * 1024): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > limit) throw new InquiryError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InquiryError("No request body was submitted.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new InquiryError("Request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new InquiryError("Submit valid JSON."); }
}
