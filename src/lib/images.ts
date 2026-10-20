/**
 * Shrink photos on the phone before upload. A typical phone photo is 3 to 8 MB;
 * resized to 1600px on its long side as a JPEG it is usually 150 to 400 KB,
 * which is still sharp enough for the AI to read a page or a formula.
 */

const MAX_SIDE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 500 * 1024;

function readAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(blob);
  });
}

export type ShrunkImage = { dataUrl: string; mediaType: string; before: number; after: number };

export async function shrinkImage(file: File): Promise<ShrunkImage> {
  const original = async (): Promise<ShrunkImage> => ({
    dataUrl: await readAsDataUrl(file),
    mediaType: file.type || "image/jpeg",
    before: file.size,
    after: file.size,
  });
  if (file.size < SKIP_BELOW_BYTES || typeof createImageBitmap === "undefined") return original();
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return original();
    return { dataUrl: await readAsDataUrl(blob), mediaType: "image/jpeg", before: file.size, after: blob.size };
  } catch {
    // Formats the browser can't draw (some HEIC photos) go up as they are.
    return original();
  }
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
