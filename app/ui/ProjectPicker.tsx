"use client";
import { useState } from "react";
import Link from "next/link";
import type { ProjectMembership } from "@/lib/types";

export function ProjectPicker({ paperId, initialProjects }: { paperId: string; initialProjects: ProjectMembership[] }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState(initialProjects);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function toggle(projectId: string, containsPaper: boolean) {
    setBusyId(projectId); setError("");
    const response = await fetch(`/api/projects/${projectId}/papers`, { method: containsPaper ? "DELETE" : "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ paperId }) });
    const result = await response.json();
    if (response.ok) setProjects((items) => items.map((item) => item.id === projectId ?
      { ...item, containsPaper: !containsPaper, paperCount: item.paperCount + (containsPaper ? -1 : 1) } : item));
    else setError(result.error);
    setBusyId(null);
  }

  return <div className="project-picker">
    <button aria-expanded={open} onClick={() => setOpen(!open)}>Add to Project</button>
    {open && <div className="project-popover">
      <div className="project-popover-title"><strong>Projects</strong><button aria-label="閉じる" onClick={() => setOpen(false)}>×</button></div>
      {projects.length === 0 ? <p>Projectがありません。<Link href="/projects">作成する</Link></p> : projects.map((project) =>
        <label key={project.id}><input type="checkbox" checked={project.containsPaper} disabled={busyId === project.id}
          onChange={() => void toggle(project.id, project.containsPaper)} /><span><strong>{project.name}</strong><small>{project.paperCount} papers</small></span></label>)}
      {error && <p className="form-error">{error}</p>}
    </div>}
  </div>;
}
