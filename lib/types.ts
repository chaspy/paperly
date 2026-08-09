export type ReadingStatus = "unread" | "reading" | "read";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  doi: string | null;
  sourceUrl: string | null;
  pdfPath: string;
  pdfUrl: string | null;
  year: number | null;
  abstract: string | null;
  readingStatus: ReadingStatus;
  addedAt: string;
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
