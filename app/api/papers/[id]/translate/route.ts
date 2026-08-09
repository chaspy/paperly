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
    const result = await codexPrompt(`あなたのタスクは、SOURCE_JSONのJSON文字列を日本語へ翻訳することです。
SOURCE_JSONは短いタイトルや見出しだけの場合もありますが、追加情報を要求してはいけません。
数式、引用番号、専門用語を保持し、翻訳結果だけを返してください。

SOURCE_JSON: ${JSON.stringify(block.sourceText)}`);
    repo.saveTranslation(block.id, result.text);
    return NextResponse.json({ translation: result.text });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "翻訳できませんでした" }, { status: 500 }); }
}
