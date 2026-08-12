import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { DocumentBlock, Paper, Project, ProjectMembership, ReadingStatus } from "./types";

const dataDir = path.resolve(process.env.PAPERLY_DATA_DIR ?? "data");
fs.mkdirSync(path.join(dataDir, "papers"), { recursive: true });

const db = new Database(path.join(dataDir, "paperly.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS papers (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, authors_json TEXT NOT NULL DEFAULT '[]',
    doi TEXT, source_url TEXT, pdf_path TEXT NOT NULL, pdf_url TEXT, year INTEGER,
    abstract TEXT, reading_status TEXT NOT NULL DEFAULT 'unread', added_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS document_blocks (
    id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    page INTEGER NOT NULL, block_type TEXT NOT NULL, source_text TEXT NOT NULL,
    translated_text TEXT, order_index INTEGER NOT NULL, bbox_json TEXT
  );
  CREATE INDEX IF NOT EXISTS blocks_paper_order ON document_blocks(paper_id, order_index);
  CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY, paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    document_block_id TEXT NOT NULL REFERENCES document_blocks(id) ON DELETE CASCADE,
    selected_text TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY, paper_id TEXT NOT NULL UNIQUE REFERENCES papers(id) ON DELETE CASCADE,
    codex_thread_id TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, content TEXT NOT NULL, selected_text TEXT, context TEXT, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS project_papers (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    paper_id TEXT NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL, PRIMARY KEY (project_id, paper_id)
  );
  CREATE INDEX IF NOT EXISTS project_papers_paper ON project_papers(paper_id);
`);
const paperColumns = new Set((db.prepare("PRAGMA table_info(papers)").all() as Array<{ name: string }>).map((item) => item.name));
if (!paperColumns.has("bilingual_pdf_path")) db.exec("ALTER TABLE papers ADD COLUMN bilingual_pdf_path TEXT");
if (!paperColumns.has("translation_status")) db.exec("ALTER TABLE papers ADD COLUMN translation_status TEXT NOT NULL DEFAULT 'pending'");
if (!paperColumns.has("arxiv_id")) db.exec("ALTER TABLE papers ADD COLUMN arxiv_id TEXT");
if (!paperColumns.has("notes")) db.exec("ALTER TABLE papers ADD COLUMN notes TEXT NOT NULL DEFAULT ''");

type PaperRow = {
  id: string; title: string; authors_json: string; doi: string | null; source_url: string | null;
  pdf_path: string; pdf_url: string | null; year: number | null; abstract: string | null;
  reading_status: ReadingStatus; added_at: string; bilingual_pdf_path: string | null;
  translation_status: Paper["translationStatus"];
  arxiv_id: string | null;
  notes: string;
};

type ProjectRow = {
  id: string; name: string; description: string; created_at: string; updated_at: string;
  paper_count: number;
};

type BlockRow = {
  id: string; paper_id: string; page: number; block_type: DocumentBlock["blockType"];
  source_text: string; translated_text: string | null; order_index: number; bbox_json: string | null;
};

function paper(row: PaperRow): Paper {
  return { id: row.id, title: row.title, authors: JSON.parse(row.authors_json), doi: row.doi,
    arxivId: row.arxiv_id,
    sourceUrl: row.source_url, pdfPath: row.pdf_path, bilingualPdfPath: row.bilingual_pdf_path,
    translationStatus: row.translation_status, pdfUrl: row.pdf_url, year: row.year,
    abstract: row.abstract, notes: row.notes, readingStatus: row.reading_status, addedAt: row.added_at };
}

function project(row: ProjectRow): Project {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at,
    updatedAt: row.updated_at, paperCount: row.paper_count };
}

function block(row: BlockRow): DocumentBlock {
  return { id: row.id, paperId: row.paper_id, page: row.page, blockType: row.block_type,
    sourceText: row.source_text, translatedText: row.translated_text, orderIndex: row.order_index,
    bbox: row.bbox_json ? JSON.parse(row.bbox_json) : null };
}

export const repo = {
  dataDir,
  listPapers: () => (db.prepare("SELECT * FROM papers ORDER BY added_at DESC").all() as PaperRow[]).map(paper),
  getPaper: (id: string) => {
    const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(id) as PaperRow | undefined;
    return row ? paper(row) : null;
  },
  getBlocks: (paperId: string) => (db.prepare(
    "SELECT * FROM document_blocks WHERE paper_id = ? ORDER BY order_index"
  ).all(paperId) as BlockRow[]).map(block),
  insertPaper(input: Paper, blocks: DocumentBlock[]) {
    db.transaction(() => {
      db.prepare(`INSERT INTO papers (id,title,authors_json,doi,arxiv_id,source_url,pdf_path,pdf_url,year,abstract,notes,reading_status,added_at,bilingual_pdf_path,translation_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        input.id, input.title, JSON.stringify(input.authors), input.doi, input.arxivId, input.sourceUrl,
        input.pdfPath, input.pdfUrl, input.year, input.abstract, input.notes, input.readingStatus, input.addedAt,
        input.bilingualPdfPath, input.translationStatus
      );
      const stmt = db.prepare(`INSERT INTO document_blocks VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const item of blocks) stmt.run(item.id, item.paperId, item.page, item.blockType,
        item.sourceText, item.translatedText, item.orderIndex, JSON.stringify(item.bbox));
    })();
  },
  attachPdf(id: string, pdfPath: string, blocks: DocumentBlock[]) {
    db.transaction(() => {
      db.prepare("DELETE FROM document_blocks WHERE paper_id = ?").run(id);
      db.prepare(`UPDATE papers SET pdf_path = ?, bilingual_pdf_path = NULL,
        translation_status = 'pending' WHERE id = ?`).run(pdfPath, id);
      const stmt = db.prepare(`INSERT INTO document_blocks VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const item of blocks) stmt.run(item.id, item.paperId, item.page, item.blockType,
        item.sourceText, item.translatedText, item.orderIndex, JSON.stringify(item.bbox));
    })();
  },
  saveTranslation(id: string, text: string) {
    db.prepare("UPDATE document_blocks SET translated_text = ? WHERE id = ?").run(text, id);
  },
  saveTranslations(items: Array<{ id: string; text: string }>) {
    const statement = db.prepare("UPDATE document_blocks SET translated_text = ? WHERE id = ?");
    db.transaction(() => {
      for (const item of items) statement.run(item.text, item.id);
    })();
  },
  setStatus(id: string, status: ReadingStatus) {
    db.prepare("UPDATE papers SET reading_status = ? WHERE id = ?").run(status, id);
  },
  saveNotes(id: string, notes: string) {
    return db.prepare("UPDATE papers SET notes = ? WHERE id = ?").run(notes, id).changes > 0;
  },
  setBilingualStatus(id: string, status: Paper["translationStatus"], pdfPath?: string | null) {
    db.prepare("UPDATE papers SET translation_status = ?, bilingual_pdf_path = COALESCE(?, bilingual_pdf_path) WHERE id = ?")
      .run(status, pdfPath ?? null, id);
  },
  listProjects: () => (db.prepare(`SELECT p.*, COUNT(pp.paper_id) AS paper_count
    FROM projects p LEFT JOIN project_papers pp ON pp.project_id = p.id
    GROUP BY p.id ORDER BY p.updated_at DESC`).all() as ProjectRow[]).map(project),
  getProject(id: string) {
    const row = db.prepare(`SELECT p.*, COUNT(pp.paper_id) AS paper_count
      FROM projects p LEFT JOIN project_papers pp ON pp.project_id = p.id
      WHERE p.id = ? GROUP BY p.id`).get(id) as ProjectRow | undefined;
    return row ? project(row) : null;
  },
  getProjectByName(name: string) {
    const row = db.prepare(`SELECT p.*, COUNT(pp.paper_id) AS paper_count
      FROM projects p LEFT JOIN project_papers pp ON pp.project_id = p.id
      WHERE p.name = ? GROUP BY p.id`).get(name) as ProjectRow | undefined;
    return row ? project(row) : null;
  },
  createProject(name: string, description: string) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO projects VALUES (?, ?, ?, ?, ?)").run(id, name, description, now, now);
    return this.getProject(id)!;
  },
  deleteProject(id: string) {
    return db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  },
  listProjectPapers(projectId: string) {
    return (db.prepare(`SELECT papers.* FROM papers
      JOIN project_papers ON project_papers.paper_id = papers.id
      WHERE project_papers.project_id = ? ORDER BY project_papers.added_at DESC`).all(projectId) as PaperRow[]).map(paper);
  },
  listProjectsForPaper(paperId: string): ProjectMembership[] {
    return (db.prepare(`SELECT p.*, COUNT(all_pp.paper_id) AS paper_count,
      CASE WHEN membership.paper_id IS NULL THEN 0 ELSE 1 END AS contains_paper
      FROM projects p
      LEFT JOIN project_papers all_pp ON all_pp.project_id = p.id
      LEFT JOIN project_papers membership ON membership.project_id = p.id AND membership.paper_id = ?
      GROUP BY p.id ORDER BY p.updated_at DESC`).all(paperId) as Array<ProjectRow & { contains_paper: number }>).map(
        (row) => ({ ...project(row), containsPaper: Boolean(row.contains_paper) }));
  },
  addPaperToProject(projectId: string, paperId: string) {
    const now = new Date().toISOString();
    return db.transaction(() => {
      const result = db.prepare("INSERT OR IGNORE INTO project_papers VALUES (?, ?, ?)").run(projectId, paperId, now);
      if (result.changes) db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, projectId);
      return result.changes > 0;
    })();
  },
  removePaperFromProject(projectId: string, paperId: string) {
    return db.transaction(() => {
      const result = db.prepare("DELETE FROM project_papers WHERE project_id = ? AND paper_id = ?").run(projectId, paperId);
      if (result.changes) db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), projectId);
      return result.changes > 0;
    })();
  },
  saveHighlight(paperId: string, blockId: string, selectedText: string, note: string | null) {
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO highlights VALUES (?, ?, ?, ?, ?, ?)").run(
      id, paperId, blockId, selectedText, note, new Date().toISOString());
    return id;
  },
  getConversation(paperId: string) {
    return db.prepare("SELECT * FROM conversations WHERE paper_id = ?").get(paperId) as
      { id: string; codex_thread_id: string | null } | undefined;
  },
  ensureConversation(paperId: string) {
    const found = this.getConversation(paperId);
    if (found) return found;
    const id = crypto.randomUUID();
    db.prepare("INSERT INTO conversations VALUES (?, ?, NULL, ?)").run(id, paperId, new Date().toISOString());
    return { id, codex_thread_id: null };
  },
  setThread(conversationId: string, threadId: string) {
    db.prepare("UPDATE conversations SET codex_thread_id = ? WHERE id = ?").run(threadId, conversationId);
  },
  addMessage(conversationId: string, role: string, content: string, selectedText?: string, context?: string) {
    db.prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      crypto.randomUUID(), conversationId, role, content, selectedText ?? null, context ?? null,
      new Date().toISOString());
  },
  messages(conversationId: string) {
    return db.prepare("SELECT id, role, content, selected_text AS selectedText, created_at AS createdAt FROM messages WHERE conversation_id = ? ORDER BY created_at").all(conversationId);
  },
};
