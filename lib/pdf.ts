import fs from "node:fs/promises";
import type { DocumentBlock } from "./types";

type PdfTextItem = { str: string; transform: number[]; width: number; height: number; hasEOL: boolean;
  dir: string; fontName: string };

export async function extractPdf(pdfPath: string, paperId: string): Promise<DocumentBlock[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await fs.readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false }).promise;
  const result: DocumentBlock[] = [];
  let orderIndex = 0;

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is PdfTextItem => "str" in item && Boolean(item.str.trim()));
    const lines: Array<{ text: string; x: number; y: number; width: number; height: number }> = [];
    for (const item of items) {
      const x = item.transform[4];
      const y = item.transform[5];
      const last = lines.at(-1);
      if (last && Math.abs(last.y - y) < Math.max(2, item.height * 0.45)) {
        last.text += `${last.text.endsWith("-") ? "" : " "}${item.str}`;
        last.width = Math.max(last.width, x + item.width - last.x);
      } else {
        lines.push({ text: item.str, x, y, width: item.width, height: item.height });
      }
    }
    lines.sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
    for (const line of lines) {
      const text = line.text.replace(/-\s+/g, "").replace(/\s+/g, " ").trim();
      if (text.length < 2) continue;
      const heading = text.length < 120 && (line.height >= 13 || /^\d+(\.\d+)*\s+[A-Z]/.test(text));
      const reference = /^references?$/i.test(text) || /^\[?\d+\]?\s/.test(text);
      result.push({ id: crypto.randomUUID(), paperId, page: pageNo,
        blockType: reference ? "reference" : heading ? "heading" : "paragraph",
        sourceText: text, translatedText: null, orderIndex: orderIndex++,
        bbox: { x: line.x, y: line.y, width: line.width, height: line.height } });
    }
  }
  return result;
}
