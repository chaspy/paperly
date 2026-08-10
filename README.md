# Paperly

個人用・モバイルファーストの Research Paper Reader です。英語論文を日本語中心で読み、
対応する原文を確認しながら、選択箇所について Codex に質問できます。

## 開発

前提環境（現在動作確認済み）:

- macOS
- Node.js 22 / npm 10
- Python 3.12（BabelDOC用）
- `uv`
- Codex CLI 0.147.0（`codex login` 済み）

```bash
npm install
uv tool install --python 3.12 BabelDOC
npm run dev
```

初回起動時に `data/paperly.db` が作成されます。PDF は `data/papers/` に保存されます。
Codex CLI へ `codex login` 済みであれば、ChatGPT subscription 認証を使って翻訳・質問を
実行します。ブラウザは Codex App Server に接続せず、Next.js backend が localhost の
stdio transport で子プロセスを起動します。

初回に論文を開くとBabelDOCが原文と日本語を左右に組版した対訳PDFを生成します。翻訳処理は
localhost上の一時的なOpenAI互換gatewayからCodex App Serverへ渡され、API keyや外部の
従量課金APIは使用しません。生成物は `data/papers/<paper-id>-babeldoc/` にキャッシュされます。

LAN 全体へ公開せず、Tailscale IP のみに bind する例:

```bash
npm run dev -- --hostname "$(tailscale ip -4)"
```

設計・調査結果は [docs/architecture.md](docs/architecture.md) を参照してください。

## 別のMacへ引き継ぐ

コードと設計資料はGitから復元できます。論文、翻訳済みPDF、会話履歴は個人データのため
`data/` に保存され、Gitには含まれません。詳しい移行手順、動作確認、既知の制約は
[docs/handoff.md](docs/handoff.md) を参照してください。

新しいCodexセッションには [.codex/prompts/continue-paperly.md](.codex/prompts/continue-paperly.md)
を渡すと、プロダクトの目的と現在地を引き継げます。
