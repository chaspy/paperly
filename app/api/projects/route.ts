import { NextResponse } from "next/server";
import { z } from "zod";
import { repo } from "@/lib/db";

const projectSchema = z.object({
  name: z.string().trim().min(1, "Project名を入力してください").max(100),
  description: z.string().trim().max(1000).default(""),
});

export async function GET() {
  return NextResponse.json({ projects: repo.listProjects() });
}

export async function POST(request: Request) {
  try {
    const input = projectSchema.parse(await request.json());
    return NextResponse.json({ project: repo.createProject(input.name, input.description) }, { status: 201 });
  } catch (cause) {
    const message = cause instanceof z.ZodError ? cause.issues[0]?.message :
      cause instanceof Error && cause.message.includes("UNIQUE") ? "同じ名前のProjectが存在します" :
      cause instanceof Error ? cause.message : "Projectを作成できませんでした";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
