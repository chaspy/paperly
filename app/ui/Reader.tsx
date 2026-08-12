"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocumentBlock, Paper, ProjectMembership } from "@/lib/types";
import { ProjectPicker } from "./ProjectPicker";

type Message = { id: string; role: string; content: string; selectedText?: string | null };
const SelectablePdf = dynamic(() => import("./SelectablePdf").then((module) => module.SelectablePdf), { ssr: false });

export function Reader({ paper, initialBlocks, initialMessages, initialProjects }: {
  paper: Paper; initialBlocks: DocumentBlock[]; initialMessages: Message[]; initialProjects: ProjectMembership[];
}) {
  const [panel, setPanel] = useState<"chat" | "notes" | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(paper.translationStatus);
  const [viewMode, setViewMode] = useState<"translated" | "original">(
    paper.translationStatus === "ready" ? "translated" : "original"
  );
  const [error, setError] = useState("");
  const generationRequested = useRef(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [selectedText, setSelectedText] = useState("");
  const hasExtractedText = initialBlocks.length > 0;
  const [notes, setNotes] = useState(paper.notes);
  const [notesState, setNotesState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (panel === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, panel]);

  useEffect(() => {
    if (paper.readingStatus === "unread") void fetch(`/api/papers/${paper.id}/status`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "reading" }),
    });
  }, [paper.id, paper.readingStatus]);

  useEffect(() => {
    if (!paper.pdfPath || !hasExtractedText || status === "ready" || generationRequested.current) return;
    generationRequested.current = true;
    void fetch(`/api/papers/${paper.id}/bilingual`, { method: "POST" }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setStatus("ready"); setViewMode("translated");
    }).catch((cause) => { setError(cause instanceof Error ? cause.message : "生成できませんでした"); setStatus("failed"); });
  }, [hasExtractedText, paper.id, paper.pdfPath, status]);

  async function ask(askQuestion = question) {
    if (!hasExtractedText || !askQuestion.trim()) return;
    setBusy(true); setPanel("chat");
    const text = askQuestion;
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text,
      selectedText: selectedText || null }]);
    setQuestion("");
    const context = initialBlocks.slice(0, 80).map((item) => item.sourceText).join("\n");
    try {
      const response = await fetch(`/api/papers/${paper.id}/chat`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, selectedText: selectedText || undefined, context }) });
      const result = await response.json();
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant",
        content: response.ok ? result.answer : result.error }]);
    } catch {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant",
        content: "回答を取得できませんでした。もう一度お試しください。" }]);
    } finally {
      setBusy(false); setSelectedText("");
      window.getSelection()?.removeAllRanges();
    }
  }

  async function saveNotes() {
    setNotesState("saving");
    try {
      const response = await fetch(`/api/papers/${paper.id}/notes`, { method: "PATCH",
        headers: { "content-type": "application/json" }, body: JSON.stringify({ notes }) });
      if (!response.ok) throw new Error();
      setNotesState("saved");
    } catch {
      setNotesState("error");
    }
  }

  function openChatWithSelection() {
    setPanel("chat");
    window.setTimeout(() => questionInputRef.current?.focus(), 0);
  }

  async function uploadPdf(file: File) {
    setBusy(true); setError("");
    const body = new FormData();
    body.set("file", file);
    try {
      const response = await fetch(`/api/papers/${paper.id}/pdf`, { method: "PUT", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDFを追加できませんでした");
      setBusy(false);
    }
  }

  return <main className={`pdf-reader-layout ${panel ? "chat-visible" : ""}`}>
    <section className="pdf-stage">
      <nav className="pdf-toolbar">
        <Link href="/">← Library</Link>
        <div className="pdf-title"><strong>{paper.title}</strong><span>{paper.year ?? ""} · {paper.authors.slice(0, 2).join(", ")}</span></div>
        <div className="pdf-actions">
          <div className="pdf-language-toggle" aria-label="PDF表示言語">
            <button className={viewMode === "translated" ? "active" : ""} disabled={status !== "ready"}
              onClick={() => setViewMode("translated")}>日本語</button>
            <button className={viewMode === "original" ? "active" : ""} onClick={() => setViewMode("original")}>原文</button>
          </div>
          <ProjectPicker paperId={paper.id} initialProjects={initialProjects} />
          <a href={`/api/papers/${paper.id}/pdf`} target="_blank">原文PDF</a>
          <button className={panel === "chat" ? "active" : ""} onClick={() => setPanel(panel === "chat" ? null : "chat")}>Chat <span>{messages.length}</span></button>
          <button className={panel === "notes" ? "active" : ""} onClick={() => setPanel(panel === "notes" ? null : "notes")}>Notes</button>
        </div>
      </nav>
      {!paper.pdfPath ? <div className="pdf-empty"><h2>PDFが必要です</h2><p>PDFを取得できませんでした。PDFをアップロードしてください。</p>
        <button disabled={busy} onClick={() => pdfInputRef.current?.click()}>{busy ? "解析中…" : "PDFをアップロード"}</button>
        <input ref={pdfInputRef} hidden type="file" accept="application/pdf" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadPdf(file);
        }}/>{error && <p className="error">{error}</p>}</div> : <div className="pdf-document-stage">
          {(status !== "ready" || !hasExtractedText) && <div className={`translation-notice ${status}`} role="status">
            <span>{!hasExtractedText ? "画像PDFです · 翻訳とPaper ChatにはOCRが必要です" :
              status === "failed" ? "日本語版を生成できませんでした。原文を表示しています。" : "日本語版を生成中 · 原文を表示しています"}</span>
            {hasExtractedText && status === "failed" && <button onClick={() => { generationRequested.current = false; setError(""); setStatus("pending"); }}>再試行</button>}
          </div>}
          <SelectablePdf url={status === "ready" && viewMode === "translated" ?
            `/api/papers/${paper.id}/pdf?version=bilingual` : `/api/papers/${paper.id}/pdf`} onSelect={setSelectedText} />
        </div>}
    </section>
    {selectedText && panel !== "chat" && <div className="selection-bar pdf-selection"><q>{selectedText.slice(0, 90)}{selectedText.length > 90 && "…"}</q><div>
      <button onClick={() => { setSelectedText(""); window.getSelection()?.removeAllRanges(); }}>閉じる</button>
      <button onClick={openChatWithSelection}>引用して質問</button>
      <button className="primary" onClick={() => void ask("選択した箇所を、この論文の文脈に沿って分かりやすく説明してください。")}>Ask AI</button>
    </div></div>}
    <aside className={`chat ${panel ? "open" : ""}`}><header><div><span>{panel === "notes" ? "PAPER NOTES" : "PAPER CHAT"}</span>
      <h2>{panel === "notes" ? "メモと感想" : "問いを深める"}</h2></div><button aria-label="パネルを閉じる" onClick={() => setPanel(null)}>×</button></header>
      <div className="panel-tabs" role="tablist"><button className={panel === "chat" ? "active" : ""} onClick={() => setPanel("chat")}>Chat</button>
        <button className={panel === "notes" ? "active" : ""} onClick={() => setPanel("notes")}>Notes</button></div>
      {panel === "notes" ? <div className="paper-notes"><textarea aria-label="論文のメモと感想" value={notes}
        onChange={(event) => { setNotes(event.target.value); setNotesState("idle"); }}
        placeholder="気づき、疑問、あとで考えたいこと…" maxLength={50_000}/>
        <div><span aria-live="polite">{notesState === "saved" ? "保存済み" : notesState === "error" ? "保存できませんでした" : ""}</span>
          <button disabled={notesState === "saving"} onClick={() => void saveNotes()}>{notesState === "saving" ? "保存中…" : "保存"}</button></div></div> : <>
        <div className="messages">{!hasExtractedText ? <p className="chat-empty">この画像PDFは本文を抽出できていません。Paper Chatを使うにはOCRが必要です。</p> :
          messages.length === 0 && <p className="chat-empty">この論文について質問してください。</p>}
          {messages.map((message) => <div className={`message ${message.role}`} key={message.id}><span>{message.role === "assistant" ? "Paperly AI" : "You"}</span>
            {message.role === "user" && message.selectedText && <blockquote className="message-selection">{message.selectedText}</blockquote>}
            {message.role === "assistant" ? <div className="message-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer">{children}</a> }}>
              {message.content}
            </ReactMarkdown></div> : <p>{message.content}</p>}</div>)}
          {busy && <div className="message assistant thinking" role="status"><span>Paperly AI</span><p>論文を読みながら考えています<span className="thinking-dots" aria-hidden="true">…</span></p></div>}
          <div ref={messagesEndRef}/></div>
        <form onSubmit={(event) => { event.preventDefault(); void ask(); }}>
          {selectedText && <div className="chat-selection-context"><q>{selectedText}</q><button type="button" aria-label="引用を外す"
            onClick={() => { setSelectedText(""); window.getSelection()?.removeAllRanges(); }}>×</button></div>}
          <div className="chat-compose-row"><textarea ref={questionInputRef} value={question} disabled={!hasExtractedText}
            onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void ask(); }
            }} placeholder={hasExtractedText ? "この論文について質問…" : "OCR後にPaper Chatを利用できます"}/><button disabled={!hasExtractedText || busy || !question.trim()}>送信</button></div>
        </form></>}
    </aside>
  </main>;
}
