import { createServer } from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { codexPrompt } from "./codex";

type ChatRequest = { messages?: Array<{ role: string; content: string | Array<{ type: string; text?: string }> }> };

function messageText(body: ChatRequest): string {
  return (body.messages ?? []).map((message) => {
    const content = typeof message.content === "string" ? message.content :
      message.content.map((item) => item.text ?? "").join("\n");
    return `${message.role.toUpperCase()}:\n${content}`;
  }).join("\n\n");
}

export async function generateBilingualPdf(inputPath: string, outputDir: string, pages?: string): Promise<string> {
  await fs.mkdir(outputDir, { recursive: true });
  const token = crypto.randomUUID();
  const gateway = createServer(async (request, response) => {
    if (request.method !== "POST" || request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end(); return;
    }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString()) as ChatRequest;
      const prompt = `BabelDOCから渡された学術PDF翻訳タスクです。指示された形式を厳守し、英語を自然で正確な日本語へ翻訳してください。数式placeholder、XML tag、引用番号は変更しないでください。\n\n${messageText(body)}`;
      const result = await codexPrompt(prompt);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: crypto.randomUUID(), object: "chat.completion", created: Math.floor(Date.now() / 1000),
        model: "paperly-codex", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: result.text } }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : "translation failed" } }));
    }
  });
  await new Promise<void>((resolve) => gateway.listen(0, "127.0.0.1", resolve));
  const address = gateway.address();
  if (!address || typeof address === "string") throw new Error("翻訳gatewayを起動できません");

  const args = ["--files", inputPath, "--output", outputDir, "--lang-in", "en", "--lang-out", "ja",
    "--openai", "--openai-model", "paperly-codex", "--openai-base-url", `http://127.0.0.1:${address.port}/v1`,
    "--openai-api-key", token, "--qps", "1", "--pool-max-workers", "1", "--term-pool-max-workers", "1",
    "--no-auto-extract-glossary", "--watermark-output-mode", "no_watermark", "--skip-scanned-detection"];
  if (pages) args.push("--pages", pages);
  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.env.BABELDOC_BIN ?? "babeldoc", args, { env: process.env });
      let logs = "";
      child.stdout.on("data", (chunk) => { logs += String(chunk); });
      child.stderr.on("data", (chunk) => { logs += String(chunk); });
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve(logs) : reject(new Error(`BabelDOC failed (${code})\n${logs.slice(-4000)}`)));
    });
    const files = await fs.readdir(outputDir);
    const dual = files.find((file) => /dual/i.test(file) && file.endsWith(".pdf"));
    const mono = files.find((file) => /mono/i.test(file) && file.endsWith(".pdf"));
    const result = dual ?? mono;
    if (!result) throw new Error(`BabelDOCの出力PDFがありません\n${output.slice(-2000)}`);
    return path.join(outputDir, result);
  } finally {
    await new Promise<void>((resolve) => gateway.close(() => resolve()));
  }
}
