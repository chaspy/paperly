import { NextResponse } from "next/server";
import { repo } from "@/lib/db";
import type { ReadingStatus } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await request.json();
  if (!["unread", "reading", "read"].includes(status)) return NextResponse.json({ error: "不正なstatusです" }, { status: 400 });
  if (!repo.getPaper(id)) return NextResponse.json({ error: "論文が見つかりません" }, { status: 404 });
  repo.setStatus(id, status as ReadingStatus);
  return NextResponse.json({ ok: true });
}
