"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function AddPaper() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function submit(file?: File) {
    setBusy(true); setError("");
    const body = new FormData();
    if (file) body.set("file", file); else body.set("url", url);
    try {
      const response = await fetch("/api/papers", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.push(`/papers/${result.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "追加できませんでした"); }
    finally { setBusy(false); }
  }

  return <section className="add-card"><label htmlFor="paper-url">論文を追加</label>
    <div className="add-row"><input id="paper-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)}
      placeholder="論文ページ or PDF URLをペースト" inputMode="url" />
      <button disabled={busy || !url} onClick={() => submit()}>{busy ? "解析中…" : "Add Paper"}</button></div>
    <div className="upload"><span>または</span><button className="quiet" onClick={() => fileRef.current?.click()}>PDFをアップロード</button>
      <input ref={fileRef} hidden type="file" accept="application/pdf" onChange={(event) => event.target.files?.[0] && submit(event.target.files[0])}/></div>
    {error && <p className="error">{error}</p>}
  </section>;
}
