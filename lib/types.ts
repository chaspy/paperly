export type ReadingStatus = "unread" | "reading" | "read";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  doi: string | null;
  arxivId: string | null;
  sourceUrl: string | null;
  pdfPath: string;
  bilingualPdfPath: string | null;
  translationStatus: "pending" | "processing" | "ready" | "failed";
  pdfUrl: string | null;
  year: number | null;
  abstract: string | null;
  notes: string;
  readingStatus: ReadingStatus;
  addedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  paperCount: number;
}

export interface ProjectMembership extends Project {
  containsPaper: boolean;
}

export interface DocumentBlock {
  id: string;
  paperId: string;
  page: number;
  blockType: "heading" | "paragraph" | "caption" | "reference";
  sourceText: string;
  translatedText: string | null;
  orderIndex: number;
  bbox: { x: number; y: number; width: number; height: number } | null;
}
