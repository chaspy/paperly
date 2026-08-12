import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/db";
import { ProjectPaperList } from "@/app/ui/ProjectPaperList";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = repo.getProject(id);
  if (!project) notFound();
  const papers = repo.listProjectPapers(id);
  return <main className="project-detail shell">
    <Link className="back-link" href="/projects">← Projects</Link>
    <header><p className="eyebrow">PROJECT · {project.paperCount} PAPERS</p><h1>{project.name}</h1><p>{project.description}</p></header>
    <ProjectPaperList projectId={id} papers={papers} />
  </main>;
}
