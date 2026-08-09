import { spawn } from "node:child_process";
import readline from "node:readline";

type Rpc = { id?: number; method?: string; result?: unknown; error?: { message?: string }; params?: Record<string, unknown> };

export async function codexPrompt(prompt: string, existingThread?: string | null,
  outputSchema?: Record<string, unknown>): Promise<{ text: string; threadId: string }> {
  const child = spawn(process.env.CODEX_BIN ?? "codex", ["app-server", "--listen", "stdio://"], {
    stdio: ["pipe", "pipe", "pipe"], env: process.env,
  });
  const lines = readline.createInterface({ input: child.stdout });
  let requestId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  let answer = "";
  let turnDone: (() => void) | null = null;
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });

  lines.on("line", (line) => {
    let message: Rpc;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id !== undefined && (message.result !== undefined || message.error)) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message ?? "Codex request failed"));
      else waiter.resolve(message.result);
    } else if (message.method === "item/agentMessage/delta") {
      answer += String(message.params?.delta ?? "");
    } else if (message.method === "turn/completed") {
      turnDone?.();
    }
  });

  function request(method: string, params: unknown): Promise<unknown> {
    const id = ++requestId;
    child.stdin.write(`${JSON.stringify({ method, id, params })}\n`);
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  try {
    await request("initialize", { clientInfo: { name: "paperly", title: "Paperly", version: "0.1.0" }, capabilities: null });
    child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
    const threadResponse = await request(existingThread ? "thread/resume" : "thread/start", existingThread
      ? { threadId: existingThread, approvalPolicy: "never", sandbox: "read-only" }
      : { cwd: process.cwd(), approvalPolicy: "never", sandbox: "read-only", ephemeral: false,
          developerInstructions: "You are Paperly's reading assistant. Never use tools or modify files. Answer only from supplied paper context and clearly label general knowledge or inference." });
    const threadId = String((threadResponse as { thread: { id: string } }).thread.id);
    const completed = new Promise<void>((resolve) => { turnDone = resolve; });
    await request("turn/start", { threadId, input: [{ type: "text", text: prompt }],
      approvalPolicy: "never", sandboxPolicy: { type: "readOnly" }, outputSchema });
    await Promise.race([completed, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Codex response timeout")), 120_000))]);
    if (!answer.trim()) throw new Error(stderr || "Codexから回答がありません");
    return { text: answer.trim(), threadId };
  } finally {
    lines.close();
    child.kill();
  }
}
