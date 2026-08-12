import { NextResponse } from "next/server";
import { repo } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = repo.getProject(id);
  if (!project) return NextResponse.json({ error: "Projectが見つかりません" }, { status: 404 });
  return NextResponse.json({ project, papers: repo.listProjectPapers(id) });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!repo.deleteProject(id)) return NextResponse.json({ error: "Projectが見つかりません" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
