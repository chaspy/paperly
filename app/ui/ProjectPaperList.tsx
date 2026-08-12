"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Paper } from "@/lib/types";

export function ProjectPaperList({ projectId, papers }: { projectId: string; papers: Paper[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);
  async function remove(paperId: string) {
    setRemoving(paperId);
    const response = await fetch(`/api/projects/${projectId}/papers`, { method: "DELETE",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ paperId }) });
    setRemoving(null);
    if (response.ok) router.refresh();
  }
  if (!papers.length) return <div className="project-empty"><p>このProjectにはまだPaperがありません。</p><Link href="/">LibraryからPaperを開いて追加</Link></div>;
  return <div className="project-paper-list">{papers.map((paper) => <article key={paper.id}>
    <Link href={`/papers/${paper.id}`}><span>{paper.readingStatus}</span><h2>{paper.title}</h2>
      <p>{paper.authors.join(", ") || "Unknown author"}</p></Link>
    <button disabled={removing === paper.id} onClick={() => void remove(paper.id)}>Remove</button>
  </article>)}</div>;
}
