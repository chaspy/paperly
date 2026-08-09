import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = await request.json();
  if (!["unread", "reading", "read"].includes(status)) return NextResponse.json({ error: "不正なstatusです" }, { status: 400 });
  repo.setStatus(id, status);
  return NextResponse.json({ ok: true });
}
