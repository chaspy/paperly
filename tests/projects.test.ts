import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Paper } from "../lib/types.ts";

test("Paperを複数Projectで共有し、所属解除やProject削除でもPaperを保持する", async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "paperly-projects-"));
  process.env.PAPERLY_DATA_DIR = dataDir;
  const { repo } = await import(`../lib/db.ts?test=${crypto.randomUUID()}`);
  const paper: Paper = {
    id: crypto.randomUUID(), title: "Shared paper", authors: ["Test Author"], doi: null,
    arxivId: null, sourceUrl: null, pdfPath: "", bilingualPdfPath: null,
    translationStatus: "pending", pdfUrl: null, year: 2026, abstract: null, notes: "",
    readingStatus: "unread", addedAt: new Date().toISOString(),
  };
  repo.insertPaper(paper, []);
  const first = repo.createProject("First", "First context");
  const second = repo.createProject("Second", "Second context");

  assert.equal(repo.addPaperToProject(first.id, paper.id), true);
  assert.equal(repo.addPaperToProject(first.id, paper.id), false);
  assert.equal(repo.addPaperToProject(second.id, paper.id), true);
  assert.equal(repo.listProjectPapers(first.id)[0]?.id, paper.id);
  assert.equal(repo.listProjectPapers(second.id)[0]?.id, paper.id);

  assert.equal(repo.removePaperFromProject(first.id, paper.id), true);
  assert.equal(repo.listProjectPapers(first.id).length, 0);
  assert.equal(repo.listProjectPapers(second.id)[0]?.id, paper.id);
  assert.equal(repo.getPaper(paper.id)?.title, paper.title);

  assert.equal(repo.saveNotes(paper.id, "気づきと感想"), true);
  assert.equal(repo.getPaper(paper.id)?.notes, "気づきと感想");

  repo.setStatus(paper.id, "read");
  assert.equal(repo.getPaper(paper.id)?.readingStatus, "read");

  assert.equal(repo.deleteProject(second.id), true);
  assert.equal(repo.getProject(second.id), null);
  assert.equal(repo.getPaper(paper.id)?.title, paper.title);
  await rm(dataDir, { recursive: true, force: true });
});
