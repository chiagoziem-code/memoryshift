/**
 * Pull the words out of study documents in the browser.
 * Word (.docx) and PowerPoint (.pptx) files are zip archives of XML, so we
 * unzip them with the browser's built-in decompression; no extra library.
 * PDFs are read by the AI on the server (handles scanned pages too).
 */

export const DOCUMENT_ACCEPT =
  ".pdf,.docx,.pptx,.txt,.md,.rtf,application/pdf,text/plain,text/markdown," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export type DocKind = "pdf" | "docx" | "pptx" | "text" | "unsupported";

export function documentKind(file: File): DocKind {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pptx")) return "pptx";
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".rtf") || file.type.startsWith("text/"))
    return "text";
  return "unsupported";
}

type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

/** Minimal zip reader: central directory + stored/deflated entries. */
async function readZip(buffer: ArrayBuffer): Promise<Map<string, ZipEntry> & { data: DataView }> {
  const view = new DataView(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file doesn't look like a Word or PowerPoint file");
  const count = view.getUint16(eocd + 10, true);
  let pos = view.getUint32(eocd + 16, true);
  const entries = new Map<string, ZipEntry>() as Map<string, ZipEntry> & { data: DataView };
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;
    const method = view.getUint16(pos + 10, true);
    const compressedSize = view.getUint32(pos + 20, true);
    const nameLength = view.getUint16(pos + 28, true);
    const extraLength = view.getUint16(pos + 30, true);
    const commentLength = view.getUint16(pos + 32, true);
    const offset = view.getUint32(pos + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, pos + 46, nameLength));
    entries.set(name, { name, method, compressedSize, offset });
    pos += 46 + nameLength + extraLength + commentLength;
  }
  entries.data = view;
  return entries;
}

async function readEntry(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  const view = new DataView(buffer);
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = new Uint8Array(buffer, start, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(raw);
  if (entry.method !== 8) throw new Error("Unsupported compression in this file");
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Text runs inside each paragraph, one paragraph per line. */
function xmlToLines(xml: string, paragraphTag: string, textTag: string) {
  const lines: string[] = [];
  const paraRe = new RegExp(`<${paragraphTag}[ >][\\s\\S]*?</${paragraphTag}>`, "g");
  const textRe = new RegExp(`<${textTag}(?: [^>]*)?>([\\s\\S]*?)</${textTag}>`, "g");
  for (const para of xml.match(paraRe) ?? []) {
    const parts = [...para.matchAll(textRe)].map((m) => decodeXmlEntities(m[1] ?? ""));
    const line = parts.join("").trim();
    if (line) lines.push(line);
  }
  return lines;
}

async function docxText(file: File) {
  const buffer = await file.arrayBuffer();
  const zip = await readZip(buffer);
  const doc = zip.get("word/document.xml");
  if (!doc) throw new Error("No text found in this Word file");
  return xmlToLines(await readEntry(buffer, doc), "w:p", "w:t").join("\n");
}

async function pptxText(file: File) {
  const buffer = await file.arrayBuffer();
  const zip = await readZip(buffer);
  const slides = [...zip.keys()]
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const lines = xmlToLines(await readEntry(buffer, zip.get(name)!), "a:p", "a:t");
    if (lines.length) out.push(`Slide ${i + 1}:\n${lines.join("\n")}`);
  }
  if (out.length === 0) throw new Error("No text found in this PowerPoint file");
  return out.join("\n\n");
}

/** Strip RTF control words, keeping the plain text. */
function rtfToText(rtf: string) {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\{\\\*[^{}]*\}/g, "")
    .replace(/\\'[0-9a-f]{2}/gi, "")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .trim();
}

/** Words from a non-PDF document, read on the device. */
export async function readLocalDocument(file: File): Promise<string> {
  const kind = documentKind(file);
  if (kind === "docx") return docxText(file);
  if (kind === "pptx") return pptxText(file);
  if (kind === "text") {
    const text = await file.text();
    return file.name.toLowerCase().endsWith(".rtf") ? rtfToText(text) : text;
  }
  throw new Error(`${file.name}: please use PDF, Word (.docx), PowerPoint (.pptx) or text files`);
}

export const MAX_DOC_CHARS = 12000;
