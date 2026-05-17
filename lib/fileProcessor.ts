/**
 * Universal file processor for Vera.
 * Converts any uploaded file into content Claude can analyze.
 */

// Claude's vision API accepts exactly these four media types.
type ClaudeImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

type ClaudeContent =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: ClaudeImageMediaType; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

// Only include media types that Claude's vision API actually supports.
// Note: "image/gif" is in the spec but animated GIFs are treated as static.
const IMAGE_TYPES: Record<string, ClaudeImageMediaType> = {
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
};

const AUDIO_EXTS = ["mp3", "m4a", "wav", "ogg", "aac", "flac", "wma", "qta", "caf", "aiff", "aif", "amr"];
const VIDEO_EXTS = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp"];
const TEXT_EXTS  = ["txt", "md", "csv", "html", "htm", "eml", "msg", "rtf", "xml", "json"];

function ext(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function transcribeWithWhisper(buf: ArrayBuffer, filename: string): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return `[Audio/video file: "${filename}" — Add OPENAI_API_KEY to Vercel environment variables to enable automatic transcription. The file has been stored and can be manually described.]`;
  }
  try {
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "audio/mpeg" }), filename);
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      return `[Transcription failed (${res.status}): ${err.slice(0, 200)}]`;
    }

    const transcript = await res.text();
    return `[Auto-transcribed]\n\n${transcript}`;
  } catch (e) {
    return `[Transcription error: ${String(e)}]`;
  }
}

async function extractDocx(buf: ArrayBuffer, filename: string): Promise<string> {
  const e = ext(filename);

  // mammoth only supports the modern Office Open XML (.docx) format.
  // Old binary .doc files are not supported and will throw — return a clear
  // message instead of silently swallowing the error.
  if (e === "doc") {
    return "[Legacy .doc format (Word 97-2003) cannot be extracted automatically. Please re-save the file as .docx and re-upload.]";
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth");
    // mammoth.extractRawText expects a Node.js Buffer in the `buffer` key.
    const nodeBuf = Buffer.from(buf);
    if (nodeBuf.byteLength === 0) {
      return "[Word document appears to be empty]";
    }
    const result = await mammoth.extractRawText({ buffer: nodeBuf });
    const text = (result.value as string | undefined) ?? "";
    if (!text.trim()) {
      return "[Word document contains no extractable text — it may be image-only or password-protected]";
    }
    return text;
  } catch (err) {
    return `[Could not extract text from Word document: ${String(err).slice(0, 200)}]`;
  }
}

export async function processFile(
  filename: string,
  buf: ArrayBuffer
): Promise<ClaudeContent> {
  const e = ext(filename);

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (e === "pdf") {
    return {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: Buffer.from(buf).toString("base64") },
    };
  }

  // ── Images (including screenshots) ───────────────────────────────────────
  if (IMAGE_TYPES[e]) {
    try {
      const nodeBuf = Buffer.from(buf);
      if (nodeBuf.byteLength === 0) {
        return { type: "text", text: `### ${filename}\n\n[Image file appears to be empty or corrupt]` };
      }
      return {
        type: "image",
        source: { type: "base64", media_type: IMAGE_TYPES[e], data: nodeBuf.toString("base64") },
      };
    } catch (err) {
      return {
        type: "text",
        text: `### ${filename}\n\n[Image could not be processed: ${String(err).slice(0, 200)}]`,
      };
    }
  }

  // ── HEIC (iPhone photos) → tell Claude what it is ────────────────────────
  if (e === "heic" || e === "heif") {
    return {
      type: "text",
      text: `### ${filename}\n\n[iPhone HEIC photo — contents cannot be directly analyzed. Please convert to JPG and re-upload for image analysis.]`,
    };
  }

  // ── Word documents ────────────────────────────────────────────────────────
  if (e === "docx" || e === "doc") {
    const text = await extractDocx(buf, filename);
    return { type: "text", text: `### ${filename}\n\n${text}` };
  }

  // ── Audio (voice memos, recordings, calls) ────────────────────────────────
  if (AUDIO_EXTS.includes(e)) {
    const transcript = await transcribeWithWhisper(buf, filename);
    return { type: "text", text: `### ${filename} (Audio Transcript)\n\n${transcript}` };
  }

  // ── Video (screen recordings, incident footage) ───────────────────────────
  if (VIDEO_EXTS.includes(e)) {
    const transcript = await transcribeWithWhisper(buf, filename);
    return { type: "text", text: `### ${filename} (Video Audio Transcript)\n\n${transcript}` };
  }

  // ── Spreadsheets ──────────────────────────────────────────────────────────
  if (e === "xlsx" || e === "xls") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require("xlsx");
      const workbook = XLSX.read(Buffer.from(buf), { type: "buffer", cellDates: true });
      const sections: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv   = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
        if (csv.trim()) sections.push(`## Sheet: ${sheetName}\n\n${csv.slice(0, 40000)}`);
      }
      const text = sections.join("\n\n").slice(0, 80000);
      return { type: "text", text: `### ${filename} (Excel Spreadsheet)\n\n${text}` };
    } catch (err) {
      return { type: "text", text: `### ${filename}\n\n[Excel extraction failed: ${String(err).slice(0, 200)}]` };
    }
  }

  // ── Plain text, CSV, email, HTML, etc. ────────────────────────────────────
  if (TEXT_EXTS.includes(e)) {
    const text = Buffer.from(buf).toString("utf8").slice(0, 100000);
    return { type: "text", text: `### ${filename}\n\n${text}` };
  }

  // ── Unknown ───────────────────────────────────────────────────────────────
  return {
    type: "text",
    text: `### ${filename}\n\n[File type ".${e}" — attempting to read as text]\n\n${Buffer.from(buf).toString("utf8").slice(0, 50000)}`,
  };
}

export function isSupported(filename: string): boolean {
  const e = ext(filename);
  return [
    "pdf", "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
    "docx", "doc", "txt", "md", "csv", "html", "htm", "eml", "msg", "rtf",
    "mp3", "m4a", "wav", "ogg", "aac", "flac", "wma",
    "mp4", "mov", "avi", "mkv", "webm", "m4v",
    "xlsx", "xls",
  ].includes(e);
}
