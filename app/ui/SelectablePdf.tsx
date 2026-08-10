"use client";
import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export function SelectablePdf({ url, onSelect }: { url: string; onSelect: (text: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(0);
  const [width, setWidth] = useState(900);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width - 32)));
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  function capture() {
    const selection = window.getSelection();
    const text = selection?.toString().replace(/\s+/g, " ").trim();
    if (text && selection && root.current?.contains(selection.anchorNode)) onSelect(text);
  }

  return <div className="selectable-pdf" ref={root} onMouseUp={capture} onTouchEnd={() => setTimeout(capture, 50)}>
    <div className="custom-pdf-tools"><span>{pages ? `${pages} pages` : "PDFを読込中…"}</span><div>
      <button aria-label="縮小" onClick={() => setZoom((value) => Math.max(.55, value - .1))}>−</button>
      <strong>{Math.round(zoom * 100)}%</strong>
      <button aria-label="拡大" onClick={() => setZoom((value) => Math.min(2, value + .1))}>＋</button></div></div>
    <Document file={url} onLoadSuccess={({ numPages }) => setPages(numPages)} loading={<div className="pdf-loading">対訳PDFを読み込んでいます…</div>}>
      {Array.from({ length: pages }, (_, index) => <Page key={index + 1} pageNumber={index + 1}
        width={width * zoom} renderTextLayer renderAnnotationLayer />)}
    </Document>
  </div>;
}
