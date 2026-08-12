import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import { extractPdf } from "@/lib/pdf";
import { inspectPaperUrl, safeFetch } from "@/lib/remote";
import type { Paper } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ papers: repo.listPapers().map((paper) => ({
    id: paper.id,
    doi: paper.doi,
    sourceUrl: paper.sourceUrl,
    title: paper.title,
    arxivId: paper.arxivId,
  })) });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const rawUrl = String(form.get("url") ?? "").trim();
    const suppliedPdfUrl = String(form.get("pdfUrl") ?? "").trim();
    const suppliedTitle = String(form.get("title") ?? "").trim();
    const suppliedDoi = String(form.get("doi") ?? "").trim();
    const suppliedYear = Number(String(form.get("year") ?? "")) || null;
    const suppliedAbstract = String(form.get("abstract") ?? "").trim() || null;
    const suppliedArxivId = String(form.get("arxivId") ?? "").trim() || null;
    const suppliedAuthors = form.getAll("author").map(String).map((author) => author.trim()).filter(Boolean);
    const id = crypto.randomUUID();
    const pdfPath = path.join(repo.dataDir, "papers", `${id}.pdf`);
    let details = { title: "Uploaded paper", authors: [] as string[], doi: null as string | null,
      abstract: null as string | null, year: null as number | null, pdfUrl: null as string | null,
      arxivId: null as string | null };

    if (file instanceof File && file.size) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDFファイルを選択してください");
      if (file.size > 50 * 1024 * 1024) throw new Error("PDFは50MB以下にしてください");
      details.title = file.name.replace(/\.pdf$/i, "");
      await fs.writeFile(pdfPath, Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    } else if (rawUrl) {
      details = suppliedTitle ? { ...details, title: suppliedTitle, doi: suppliedDoi || null,
        authors: suppliedAuthors, pdfUrl: suppliedPdfUrl || null, year: suppliedYear,
        abstract: suppliedAbstract, arxivId: suppliedArxivId } : await inspectPaperUrl(rawUrl);
      if (!details.pdfUrl) {
        const paper: Paper = { id, title: details.title, authors: details.authors, doi: details.doi, arxivId: details.arxivId,
          sourceUrl: rawUrl, pdfPath: "", bilingualPdfPath: null, translationStatus: "pending", pdfUrl: null, year: details.year,
          abstract: details.abstract, notes: "", readingStatus: "unread", addedAt: new Date().toISOString() };
        repo.insertPaper(paper, []);
        return NextResponse.json({ id, needsPdf: true });
      }
      const response = await safeFetch(details.pdfUrl, { headers: { accept: "application/pdf" } });
      if (!response.ok) throw new Error("PDFを取得できませんでした。PDFをアップロードしてください");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 50 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("PDFを取得できませんでした。PDFをアップロードしてください");
      await fs.writeFile(pdfPath, bytes, { flag: "wx" });
    } else throw new Error("URLまたはPDFを指定してください");

    if (suppliedTitle) details.title = suppliedTitle;
    if (suppliedDoi) details.doi = suppliedDoi;
    if (suppliedAuthors.length) details.authors = suppliedAuthors;
    if (suppliedPdfUrl) details.pdfUrl = suppliedPdfUrl;
    if (suppliedYear) details.year = suppliedYear;
    if (suppliedAbstract) details.abstract = suppliedAbstract;
    if (suppliedArxivId) details.arxivId = suppliedArxivId;
    const blocks = await extractPdf(pdfPath, id);
    const paper: Paper = { id, title: details.title, authors: details.authors, doi: details.doi, arxivId: details.arxivId,
      sourceUrl: rawUrl || null, pdfPath, bilingualPdfPath: null, translationStatus: "pending", pdfUrl: details.pdfUrl, year: details.year,
      abstract: details.abstract, notes: "", readingStatus: "unread", addedAt: new Date().toISOString() };
    repo.insertPaper(paper, blocks);
    return NextResponse.json({ id, needsOcr: blocks.length === 0 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "追加できませんでした" }, { status: 400 });
  }
}
