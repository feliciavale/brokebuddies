/**
 * Free receipt OCR that runs entirely in the browser (Tesseract.js).
 * The language data (Indonesian + English) is downloaded once from a public
 * CDN and cached by the browser. No server, no API key.
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
    const { data } = await worker.recognize(await prepareForOcr(image));
    return { ...parseReceiptText(data.text), rawText: data.text };
  } finally {
    await worker.terminate();
  }
}

/**
 * Receipts photograph badly: grey thermal paper, shadows, creases.
 * Scale so text is a readable size, convert to grey, then to pure black and
 * white with an automatic (Otsu) threshold. This alone fixes many misreads.
 */
async function prepareForOcr(image: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const { loadImage } = await import("./image");
    const img = await loadImage(image);
    // Aim for ~2000px on the long side: big enough for small receipt fonts, small enough to be fast
    const scale = Math.min(2.5, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return image;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const px = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = px.data;

    // grey + histogram
    const grey = new Uint8ClampedArray(d.length / 4);
    const hist = new Array<number>(256).fill(0);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      grey[j] = g;
      hist[g]++;
    }

    // Otsu threshold
    const total = grey.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0;
    let wB = 0;
    let best = 0;
    let threshold = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) ** 2;
      if (between > best) {
        best = between;
        threshold = t;
      }
    }

    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const v = grey[j] > threshold ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(px, 0, 0);
    return canvas;
  } catch {
    return image;
  }
}
