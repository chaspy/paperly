"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { DocumentBlock, Paper } from "@/lib/types";

type Message = { id: string; role: string; content: string };
const SelectablePdf = dynamic(() => import("./SelectablePdf").then((module) => module.SelectablePdf), { ssr: false });

export function Reader({ paper, initialBlocks, initialMessages }: {
  paper: Paper; initialBlocks: DocumentBlock[]; initialMessages: Message[];
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(paper.translationStatus);
  const [error, setError] = useState("");
  const generationRequested = useRef(false);
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    if (paper.readingStatus === "unread") void fetch(`/api/papers/${paper.id}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "reading" }),
    });
  }, [paper.id, paper.readingStatus]);

  useEffect(() => {
    if (!paper.pdfPath || status === "ready" || generationRequested.current) return;
    generationRequested.current = true;
    void fetch(`/api/papers/${paper.id}/bilingual`, { method: "POST" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus("ready");
    }).catch((cause) => { setError(cause instanceof Error ? cause.message : "生成できませんでした"); setStatus("failed"); });
  }, [paper.id, paper.pdfPath, status]);

  async function ask(askQuestion = question) {
    if (!askQuestion.trim()) return;
    setBusy(true); setChatOpen(true);
    const text = askQuestion;
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text }]);
    setQuestion("");
    const context = initialBlocks.slice(0, 80).map((item) => item.sourceText).join("\n");
    const response = await fetch(`/api/papers/${paper.id}/chat`, { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: text, selectedText: selectedText || undefined, context }) });
    const result = await response.json();
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: response.ok ? result.answer : result.error }]);
    setBusy(false);
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  }

  return <main className={`pdf-reader-layout ${chatOpen ? "chat-visible" : ""}`}>
    <section className="pdf-stage">
      <nav className="pdf-toolbar">
        <Link href="/">← Library</Link>
        <div className="pdf-title"><strong>{paper.title}</strong><span>{paper.year ?? ""} · {paper.authors.slice(0, 2).join(", ")}</span></div>
        <div className="pdf-actions">
          <a href={`/api/papers/${paper.id}/pdf`} target="_blank">原文PDF</a>
          <button onClick={() => setChatOpen(!chatOpen)}>Chat <span>{messages.length}</span></button>
        </div>
      </nav>
      {!paper.pdfPath ? <div className="pdf-empty"><h2>PDFが必要です</h2><p>PDFを取得できませんでした。PDFをアップロードしてください。</p></div> :
        status === "ready" ? <SelectablePdf url={`/api/papers/${paper.id}/pdf?version=bilingual`} onSelect={setSelectedText} /> :
        <div className="pdf-generating"><div className="spinner"/><p className="eyebrow">BABELDOC + CODEX</p>
          <h2>{status === "failed" ? "対訳PDFを生成できませんでした" : "原文のレイアウトを保ったまま翻訳中"}</h2>
          <p>{status === "failed" ? error : "初回だけ数分かかります。図表・数式・段組みを解析し、日本語版を組版しています。"}</p>
          {status === "failed" && <button onClick={() => { generationRequested.current = false; setError(""); setStatus("pending"); }}>再試行</button>}</div>}
    </section>
    {selectedText && <div className="selection-bar pdf-selection"><q>{selectedText.slice(0, 90)}{selectedText.length > 90 && "…"}</q><div>
      <button onClick={() => { setSelectedText(""); window.getSelection()?.removeAllRanges(); }}>閉じる</button>
      <button className="primary" onClick={() => void ask("選択した箇所を、この論文の文脈に沿って分かりやすく説明してください。")}>Ask AI</button>
    </div></div>}
    <aside className={`chat ${chatOpen ? "open" : ""}`}><header><div><span>PAPER CHAT</span><h2>問いを深める</h2></div><button onClick={() => setChatOpen(false)}>×</button></header>
      <div className="messages">{messages.length === 0 && <p className="chat-empty">この論文について質問してください。</p>}
        {messages.map((message) => <div className={`message ${message.role}`} key={message.id}><span>{message.role === "assistant" ? "Paperly AI" : "You"}</span><p>{message.content}</p></div>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); void ask(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="この論文について質問…"/><button disabled={busy || !question.trim()}>送信</button></form>
    </aside>
  </main>;
}
