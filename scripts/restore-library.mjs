import fs from "node:fs/promises";

const baseUrl = (process.env.PAPERLY_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const manifest = JSON.parse(await fs.readFile(new URL("../seed/papers.json", import.meta.url), "utf8"));

const libraryResponse = await fetch(`${baseUrl}/api/papers`);
if (!libraryResponse.ok) {
  throw new Error(`Paperlyへ接続できません (${libraryResponse.status}): ${baseUrl}`);
}
const { papers } = await libraryResponse.json();
const normalizeUrl = (value) => value?.replace(/[?#].*$/, "").replace(/\/$/, "") ?? null;
const existingUrls = new Set(papers.map((paper) => normalizeUrl(paper.sourceUrl)).filter(Boolean));
const existingDois = new Set(papers.map((paper) => paper.doi?.toLowerCase()).filter(Boolean));

for (const entry of manifest) {
  if (existingUrls.has(normalizeUrl(entry.sourceUrl)) ||
      (entry.doi && existingDois.has(entry.doi.toLowerCase()))) {
    console.log(`skip: ${entry.title}`);
    continue;
  }

  const form = new FormData();
  // Metadataを保つため論文ページを優先する。取得可能なPDFはbackendがページから解決する。
  form.set("url", entry.sourceUrl);
  const response = await fetch(`${baseUrl}/api/papers`, { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) {
    console.error(`failed: ${entry.title}: ${result.error ?? response.statusText}`);
    continue;
  }
  console.log(`${result.needsPdf ? "metadata" : "added"}: ${entry.title}`);
}
