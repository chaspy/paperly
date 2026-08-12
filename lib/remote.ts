import dns from "node:dns/promises";
import net from "node:net";

function isPrivate(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") ||
    value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("http(s) の公開URLを指定してください");
  }
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivate(address))) {
    throw new Error("private network 宛のURLは取得できません");
  }
  return url;
}

export async function safeFetch(raw: string, init?: RequestInit, redirects = 0): Promise<Response> {
  if (redirects > 4) throw new Error("redirectが多すぎます");
  const url = await assertPublicUrl(raw);
  const response = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(120_000),
    headers: { "user-agent": "Paperly/0.1 (personal research reader)", ...init?.headers } });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("不正なredirectです");
    return safeFetch(new URL(location, url).toString(), init, redirects + 1);
  }
  return response;
}

export type PageMetadata = {
  title: string; authors: string[]; doi: string | null; abstract: string | null;
  year: number | null; pdfUrl: string | null; arxivId: string | null;
};

export function arxivIdFromUrl(raw: string): string | null {
  const match = raw.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?/i);
  return match?.[1] ?? null;
}

function meta(html: string, name: string): string[] {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  return tags.flatMap((tag) => {
    const key = tag.match(/(?:name|property)=["']([^"']+)["']/i)?.[1];
    const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
    return key?.toLowerCase() === name.toLowerCase() && content ? [decode(content)] : [];
  });
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi,
      (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)));
}

export async function inspectPaperUrl(raw: string): Promise<PageMetadata> {
  const response = await safeFetch(raw, { headers: { accept: "text/html,application/pdf" } });
  if (!response.ok) throw new Error(`論文ページを取得できません (${response.status})`);
  const contentType = response.headers.get("content-type") ?? "";
  const urlArxivId = arxivIdFromUrl(raw);
  if (contentType.includes("application/pdf")) {
    return { title: new URL(raw).pathname.split("/").at(-1)?.replace(/\.pdf$/i, "") || "Untitled paper",
      authors: [], doi: urlArxivId ? `10.48550/arXiv.${urlArxivId}` : null, abstract: null,
      year: null, pdfUrl: raw, arxivId: urlArxivId };
  }
  const html = await response.text();
  const title = meta(html, "citation_title")[0] ?? meta(html, "og:title")[0] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "Untitled paper";
  const date = meta(html, "citation_publication_date")[0] ?? meta(html, "citation_date")[0];
  const linkedPdf = html.match(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/i)?.[1];
  const pdfUrl = meta(html, "citation_pdf_url")[0] ?? meta(html, "eprints.document_url")[0] ?? linkedPdf ?? null;
  const arxivId = meta(html, "citation_arxiv_id")[0] ?? urlArxivId;
  const doi = meta(html, "citation_doi")[0] ?? raw.match(/10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+/)?.[0] ??
    (arxivId ? `10.48550/arXiv.${arxivId}` : null);
  return { title, authors: meta(html, "citation_author"), doi,
    abstract: meta(html, "citation_abstract")[0] ?? meta(html, "description")[0] ?? null,
    year: date ? Number(date.match(/\d{4}/)?.[0]) || null : null,
    pdfUrl: pdfUrl ? new URL(pdfUrl, raw).toString() : null, arxivId };
}
