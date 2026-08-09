import { NextResponse } from "next/server";
import { codexPrompt } from "@/lib/codex";
import { repo } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const paper = repo.getPaper(id);
    if (!paper) return NextResponse.json({ error: "論文が見つかりません" }, { status: 404 });
    const body = await request.json();
    const conversation = repo.ensureConversation(id);
    const context = body.context ? `\n選択箇所を含むblock:\n${body.context}` : "";
    const selected = body.selectedText ? `\n選択された文章:\n${body.selectedText}` : "";
    const prompt = `論文「${paper.title}」について回答してください。\n質問: ${body.question}${selected}${context}\n\n回答は必ず「論文から読み取れること」と「AIによる解釈・一般知識」を分けてください。提供された本文で確認できない主張は論文の主張として扱わず、確認できないと明記してください。日本語で簡潔に回答してください。`;
    repo.addMessage(conversation.id, "user", body.question, body.selectedText, body.context);
    const result = await codexPrompt(prompt, conversation.codex_thread_id);
    if (!conversation.codex_thread_id) repo.setThread(conversation.id, result.threadId);
    repo.addMessage(conversation.id, "assistant", result.text);
    return NextResponse.json({ answer: result.text });
  } catch (cause) { return NextResponse.json({ error: cause instanceof Error ? cause.message : "回答できませんでした" }, { status: 500 }); }
}
