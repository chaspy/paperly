import Link from "next/link";
import { repo } from "@/lib/db";
import { AddPaper } from "./ui/AddPaper";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const papers = repo.listPapers();
  return <main className="library shell">
    <section className="hero"><p className="eyebrow">YOUR RESEARCH LIBRARY</p><h1>読むことから、問いを育てる。</h1>
      <p>論文を追加して、日本語を道しるべに原文へ潜ろう。</p></section>
    <AddPaper />
    <section className="paper-list"><div className="section-title"><h2>Library</h2><span>{papers.length} papers</span></div>
      {papers.length === 0 ? <div className="empty"><span>01</span><p>最初の論文を追加してください。<br/>arXiv、PubMed、J-STAGE、PDFに対応しています。</p></div> : papers.map((paper) =>
        <Link className="paper-card" href={`/papers/${paper.id}`} key={paper.id}>
          <div><span className={`status ${paper.readingStatus}`}>{paper.readingStatus}</span><h3>{paper.title}</h3>
            <p>{paper.authors.join(", ") || "Unknown author"}</p></div><strong>{paper.year ?? "—"}</strong>
        </Link>)}
    </section>
  </main>;
}
