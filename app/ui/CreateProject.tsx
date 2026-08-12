"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateProject() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const response = await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error); setBusy(false); return; }
    router.push(`/projects/${result.project.id}`);
    router.refresh();
  }

  if (!open) return <button className="project-create-button" onClick={() => setOpen(true)}>新規Project</button>;
  return <form className="project-form" onSubmit={submit}>
    <label>Project name<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Description<textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    {error && <p className="form-error">{error}</p>}
    <div><button type="button" className="secondary" onClick={() => setOpen(false)}>キャンセル</button>
      <button className="primary" disabled={busy}>{busy ? "作成中…" : "作成"}</button></div>
  </form>;
}
