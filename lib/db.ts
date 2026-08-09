import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { DocumentBlock, Paper, ReadingStatus } from "./types";

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
`);

type PaperRow = {
  id: string; title: string; authors_json: string; doi: string | null; source_url: string | null;
  pdf_path: string; pdf_url: string | null; year: number | null; abstract: string | null;
  reading_status: ReadingStatus; added_at: string;
};

type BlockRow = {
  id: string; paper_id: string; page: number; block_type: DocumentBlock["blockType"];
  source_text: string; translated_text: string | null; order_index: number; bbox_json: string | null;
};

function paper(row: PaperRow): Paper {
  return { id: row.id, title: row.title, authors: JSON.parse(row.authors_json), doi: row.doi,
    sourceUrl: row.source_url, pdfPath: row.pdf_path, pdfUrl: row.pdf_url, year: row.year,
    abstract: row.abstract, readingStatus: row.reading_status, addedAt: row.added_at };
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
      db.prepare(`INSERT INTO papers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        input.id, input.title, JSON.stringify(input.authors), input.doi, input.sourceUrl,
        input.pdfPath, input.pdfUrl, input.year, input.abstract, input.readingStatus, input.addedAt
      );
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
