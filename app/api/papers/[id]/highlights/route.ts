import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const block = repo.getBlocks(id).find((item) => item.id === body.blockId);
  if (!block || !body.selectedText || !block.sourceText.includes(body.selectedText)) return NextResponse.json({ error: "選択範囲が不正です" }, { status: 400 });
  return NextResponse.json({ id: repo.saveHighlight(id, block.id, body.selectedText, body.note) });
}
