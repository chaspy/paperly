import path from "node:path";
import { NextResponse } from "next/server";
import { generateBilingualPdf } from "@/lib/babeldoc";
import { repo } from "@/lib/db";

export const maxDuration = 1800;
const generationJobs = new Map<string, Promise<string>>();

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = repo.getPaper(id);
  if (!paper?.pdfPath) return NextResponse.json({ error: "原PDFがありません" }, { status: 404 });
  if (!repo.getBlocks(id).length) return NextResponse.json({ error: "画像PDFの翻訳にはOCRが必要です" }, { status: 422 });
  if (paper.bilingualPdfPath && paper.translationStatus === "ready") return NextResponse.json({ ready: true });
  repo.setBilingualStatus(id, "processing");
  try {
    const outputDir = path.join(repo.dataDir, "papers", `${id}-babeldoc`);
    let job = generationJobs.get(id);
    if (!job) {
      job = generateBilingualPdf(paper.pdfPath, outputDir);
      generationJobs.set(id, job);
    }
    const result = await job;
    repo.setBilingualStatus(id, "ready", result);
    return NextResponse.json({ ready: true });
  } catch (error) {
    repo.setBilingualStatus(id, "failed");
    return NextResponse.json({ error: error instanceof Error ? error.message : "対訳PDFを生成できませんでした" }, { status: 500 });
  } finally {
    generationJobs.delete(id);
  }
}
