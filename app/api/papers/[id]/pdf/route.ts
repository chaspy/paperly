import fs from "node:fs";
import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

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
