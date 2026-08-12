import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { extractPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = repo.getPaper(id);
  if (!paper) return NextResponse.json({ error: "論文が見つかりません" }, { status: 404 });
  const bilingual = new URL(request.url).searchParams.get("version") === "bilingual";
  const filePath = bilingual ? paper.bilingualPdfPath : paper.pdfPath;
  if (!filePath || !fs.existsSync(filePath)) return NextResponse.json({ error: "PDFがありません" }, { status: 404 });
  const size = fs.statSync(filePath).size;
  return new Response(fs.createReadStream(filePath) as unknown as BodyInit, { headers: {
    "content-type": "application/pdf", "content-length": String(size),
    "content-disposition": `inline; filename="${bilingual ? "bilingual" : "original"}.pdf"`,
    "cache-control": "private, max-age=3600",
  } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = repo.getPaper(id);
  if (!paper) return NextResponse.json({ error: "論文が見つかりません" }, { status: 404 });
  if (paper.pdfPath) return NextResponse.json({ error: "原PDFは登録済みです" }, { status: 409 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "PDFファイルを選択してください" }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "PDFファイルを選択してください" }, { status: 400 });
  }
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json({ error: "PDFは50MB以下にしてください" }, { status: 400 });
  }

  const pdfPath = path.join(repo.dataDir, "papers", `${id}.pdf`);
  try {
    await fsPromises.writeFile(pdfPath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    const blocks = await extractPdf(pdfPath, id);
    repo.attachPdf(id, pdfPath, blocks);
    return NextResponse.json({ id, needsOcr: blocks.length === 0 });
  } catch (cause) {
    await fsPromises.rm(pdfPath, { force: true });
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "PDFを追加できませんでした" }, { status: 400 });
  }
}
