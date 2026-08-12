import Link from "next/link";
import { repo } from "@/lib/db";
import { CreateProject } from "@/app/ui/CreateProject";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const projects = repo.listProjects();
  return <main className="projects shell">
    <header className="projects-head"><div><p className="eyebrow">READING CONTEXTS</p><h1>Projects</h1>
      <p>目的や問いごとに、同じLibraryのPaperを束ねます。</p></div><CreateProject /></header>
    <section className="project-list" aria-label="Project一覧">
      {projects.length === 0 ? <div className="project-empty"><p>Projectがありません。</p></div> : projects.map((project) =>
        <Link className="project-row" href={`/projects/${project.id}`} key={project.id}>
          <div><h2>{project.name}</h2><p>{project.description || "説明はありません"}</p></div>
          <strong>{project.paperCount}<span> papers</span></strong>
        </Link>)}
    </section>
  </main>;
}
