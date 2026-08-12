import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/db";

const notesSchema = z.object({ notes: z.string().max(50_000) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!repo.getPaper(id)) return NextResponse.json({ error: "論文が見つかりません" }, { status: 404 });
    const { notes } = notesSchema.parse(await request.json());
    repo.saveNotes(id, notes);
    return NextResponse.json({ saved: true });
  } catch (cause) {
    const message = cause instanceof z.ZodError ? cause.issues[0]?.message :
      cause instanceof Error ? cause.message : "メモを保存できませんでした";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
