import test from "node:test";
import assert from "node:assert/strict";
import { arxivIdFromUrl, assertPublicUrl } from "../lib/remote.ts";

test("localhost URLを拒否する", async () => {
  await assert.rejects(assertPublicUrl("http://127.0.0.1/private.pdf"), /private network/);
});

test("http(s)以外を拒否する", async () => {
  await assert.rejects(assertPublicUrl("file:///etc/passwd"), /http\(s\)/);
});

test("arXiv URLからIDを抽出する", () => {
  assert.equal(arxivIdFromUrl("https://arxiv.org/abs/2511.04703"), "2511.04703");
  assert.equal(arxivIdFromUrl("https://arxiv.org/pdf/2511.04703v1.pdf"), "2511.04703");
});
