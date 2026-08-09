import { NextResponse } from "next/server";
import { codexPrompt } from "@/lib/codex";
import { repo } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { blockId } = await request.json();
    const block = repo.getBlocks(id).find((item) => item.id === blockId);
    if (!block) return NextResponse.json({ error: "本文が見つかりません" }, { status: 404 });
    if (block.translatedText) return NextResponse.json({ translation: block.translatedText });
    const result = await codexPrompt(`次の学術論文の文章を自然で正確な日本語に翻訳してください。数式、引用番号、専門用語を保持し、翻訳本文だけを返してください。\n\n${block.sourceText}`);
    repo.saveTranslation(block.id, result.text);
    return NextResponse.json({ translation: result.text });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "翻訳できませんでした" }, { status: 500 }); }
}
