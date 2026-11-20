/**
 * Free receipt OCR that runs entirely in the browser (Tesseract.js).
 * The language data (~10 MB, Indonesian + English) is downloaded once
 * from a public CDN and cached by the browser. No server, no API key.
 */
import { parseReceiptText, type ParsedReceipt } from "./receipt-parser";

export async function scanReceipt(
  image: Blob,
  onProgress?: (pct: number, status: string) => void,
): Promise<ParsedReceipt & { rawText: string }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker(["ind", "eng"], 1, {
    logger: (m) => onProgress?.(Math.round((m.progress ?? 0) * 100), m.status),
  });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
    const { data } = await worker.recognize(await toGrayscale(image));
    return { ...parseReceiptText(data.text), rawText: data.text };
  } finally {
    await worker.terminate();
  }
}

/** Grayscale + contrast boost helps a lot with thermal-paper receipts. */
async function toGrayscale(image: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const { loadImage } = await import("./image");
    const img = await loadImage(image);
    // OCR likes text around 30px tall: upscale small photos a little
    const scale = Math.min(2, Math.max(1, 1600 / Math.max(img.width, img.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return image;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = px.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const c = Math.max(0, Math.min(255, (g - 128) * 1.5 + 128));
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(px, 0, 0);
    return canvas;
  } catch {
    return image;
  }
}
