import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/db";

const membershipSchema = z.object({ paperId: z.string().uuid() });

async function input(request: Request, projectId: string) {
  const project = repo.getProject(projectId);
  if (!project) throw new Error("Projectが見つかりません");
  const value = membershipSchema.parse(await request.json());
  if (!repo.getPaper(value.paperId)) throw new Error("Paperが見つかりません");
  return value;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { paperId } = await input(request, id);
    repo.addPaperToProject(id, paperId);
    return NextResponse.json({ added: true });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "追加できませんでした" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { paperId } = await input(request, id);
    repo.removePaperFromProject(id, paperId);
    return NextResponse.json({ removed: true });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "解除できませんでした" }, { status: 400 });
  }
}
