"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DocumentBlock, Paper } from "@/lib/types";

type Message = { id: string; role: string; content: string };
type Selection = { blockId: string; text: string; context: string };

export function Reader({ paper, initialBlocks, initialMessages }: { paper: Paper; initialBlocks: DocumentBlock[]; initialMessages: Message[] }) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [translationState, setTranslationState] = useState<Record<number, "loading" | "done" | "error">>({});
  const requestedPages = useRef(new Set<number>());
  const pages = useMemo(() => [...new Set(blocks.map((item) => item.page))], [blocks]);

  useEffect(() => {
    if (paper.readingStatus === "unread") fetch(`/api/papers/${paper.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "reading" }) });
  }, [paper.id, paper.readingStatus]);

  useEffect(() => {
    const nextPage = pages.find((page) => !requestedPages.current.has(page) &&
      blocks.some((item) => item.page === page && !item.translatedText));
    if (nextPage === undefined) return;
    requestedPages.current.add(nextPage);
    setTranslationState((state) => ({ ...state, [nextPage]: "loading" }));
    void fetch(`/api/papers/${paper.id}/translate`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ page: nextPage }) }).then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        const translated = new Map<string, string>(result.translations.map((item: { id: string; text: string }) => [item.id, item.text]));
        setBlocks((all) => all.map((item) => translated.has(item.id) ? { ...item, translatedText: translated.get(item.id)! } : item));
        setTranslationState((state) => ({ ...state, [nextPage]: "done" }));
      }).catch(() => setTranslationState((state) => ({ ...state, [nextPage]: "error" })));
  }, [blocks, pages, paper.id]);

  function capture(block: DocumentBlock) {
    const selected = window.getSelection()?.toString().trim();
    if (selected) setSelection({ blockId: block.id, text: selected, context: block.sourceText });
  }

  async function ask(text = question) {
    if (!text.trim()) return;
    setBusy(true); setChatOpen(true);
    const optimistic = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((items) => [...items, optimistic]); setQuestion("");
    const response = await fetch(`/api/papers/${paper.id}/chat`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: text, selectedText: selection?.text, context: selection?.context }) });
    const result = await response.json();
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: response.ok ? result.answer : result.error }]);
    setBusy(false); setSelection(null);
  }

  async function highlight(note?: string) {
    if (!selection) return;
    await fetch(`/api/papers/${paper.id}/highlights`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ blockId: selection.blockId, selectedText: selection.text, note: note ?? null }) });
    setSelection(null); window.getSelection()?.removeAllRanges();
  }

  return <main className={`reader-layout ${chatOpen ? "chat-visible" : ""}`}>
    <article className="reader"><nav className="reader-nav"><Link href="/">← Library</Link><button onClick={() => setChatOpen(!chatOpen)}>Chat <span>{messages.length}</span></button></nav>
      <header className="paper-head"><p>{paper.year ?? "Research paper"} · {paper.authors.slice(0, 3).join(", ")}</p><h1>{paper.title}</h1></header>
      {blocks.length === 0 && <div className="empty no-pdf"><span>PDF</span><p>PDFを取得できませんでした。PDFをアップロードしてください。<br/>
        {paper.sourceUrl && <a href={paper.sourceUrl} target="_blank" rel="noreferrer">論文ページを開く ↗</a>}</p></div>}
      <div className="language-key"><span>English</span><span>日本語</span></div>
      {pages.map((page) => <section className="page" key={page}><div className="page-number">PAGE {String(page).padStart(2, "0")}
        {translationState[page] === "loading" && <span> · 日本語を生成中…</span>}
        {translationState[page] === "error" && <button onClick={() => { requestedPages.current.delete(page); setTranslationState((state) => ({ ...state, [page]: "loading" })); }}>翻訳を再試行</button>}</div>
        {blocks.filter((item) => item.page === page).map((block) => <div className={`bilingual ${block.blockType}`} key={block.id} onMouseUp={() => capture(block)} onTouchEnd={() => setTimeout(() => capture(block), 20)}>
          <div className="source" lang="en">{block.sourceText}</div>
          <div className="translation" lang="ja">{block.translatedText ?? <span className="translation-placeholder">翻訳中…</span>}</div>
        </div>)}</section>)}
    </article>
    {selection && <div className="selection-bar"><q>{selection.text.slice(0, 55)}{selection.text.length > 55 && "…"}</q><div>
      <button onClick={() => highlight()}>Highlight</button><button onClick={() => { const note = prompt("メモ"); if (note !== null) highlight(note); }}>Note</button>
      <button className="primary" onClick={() => ask("この選択箇所を、論文の文脈に沿って分かりやすく説明してください。")}>Ask AI</button></div></div>}
    <aside className={`chat ${chatOpen ? "open" : ""}`}><header><div><span>PAPER CHAT</span><h2>問いを深める</h2></div><button onClick={() => setChatOpen(false)}>×</button></header>
      <div className="messages">{messages.length === 0 && <p className="chat-empty">文章を選択するか、この論文について質問してください。</p>}
        {messages.map((message) => <div className={`message ${message.role}`} key={message.id}><span>{message.role === "assistant" ? "Paperly AI" : "You"}</span><p>{message.content}</p></div>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); ask(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="この論文について質問…"/><button disabled={busy || !question.trim()}>送信</button></form>
    </aside>
  </main>;
}
