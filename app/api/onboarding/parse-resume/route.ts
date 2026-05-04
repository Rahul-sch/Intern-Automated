/**
 * POST /api/onboarding/parse-resume
 *
 * Accepts either:
 *   - multipart/form-data with a `file` field (PDF; we extract text via
 *     pdf-parse), and optionally `text` as a fallback when extraction is empty
 *   - application/json with { text: string }
 *
 * Returns the extracted { profile, projects, skills } object — the client
 * shows it on the review screen for editing before saving to the user's
 * library.
 */
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { requireGroqKey, requireUser } from "@/lib/auth";
import { AppError, fail, ok, withErrorEnvelope } from "@/lib/errors";
import { extractFromResume } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_PDF_BYTES = 8 * 1024 * 1024; // 8MB
const TextBody = z.object({ text: z.string().min(200).max(60_000) });

async function readResumeText(req: Request): Promise<string> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    const fallback = form.get("text");
    if (file instanceof File) {
      if (file.size > MAX_PDF_BYTES) {
        throw new AppError(
          "VALIDATION",
          "PDF is too large.",
          `Max ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
          400,
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          const text = (result.text ?? "").trim();
          if (text.length < 200) {
            throw new AppError(
              "VALIDATION",
              "Couldn't extract enough text from the PDF.",
              "Your PDF may be scanned. Paste the resume text instead.",
              400,
            );
          }
          return text;
        } finally {
          await parser.destroy();
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
        throw new AppError(
          "VALIDATION",
          "Couldn't read this PDF.",
          err instanceof Error ? err.message : undefined,
          400,
        );
      }
    }
    if (typeof fallback === "string" && fallback.trim().length >= 200) {
      return fallback.trim();
    }
    throw new AppError(
      "VALIDATION",
      "Upload a PDF or paste resume text (min 200 chars).",
      undefined,
      400,
    );
  }

  if (contentType.includes("application/json")) {
    const raw = await req.json().catch(() => null);
    const parsed = TextBody.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("VALIDATION", parsed.error.issues[0].message, undefined, 400);
    }
    return parsed.data.text.trim();
  }

  throw new AppError(
    "VALIDATION",
    "Send multipart/form-data (file=PDF) or application/json ({ text }).",
    undefined,
    400,
  );
}

export async function POST(req: Request) {
  return withErrorEnvelope(async () => {
    await requireUser();
    const apiKey = await requireGroqKey();

    let text: string;
    try {
      text = await readResumeText(req);
    } catch (err) {
      if (err instanceof AppError) {
        return fail(err.code, err.message, err.status, err.hint);
      }
      throw err;
    }

    const extracted = await extractFromResume({ apiKey, text });
    return ok(extracted);
  });
}
