# Paperly

個人用・モバイルファーストの Research Paper Reader です。英語論文を日本語中心で読み、
対応する原文を確認しながら、選択箇所について Codex に質問できます。

## 開発

```bash
npm install
npm run dev
```

初回起動時に `data/paperly.db` が作成されます。PDF は `data/papers/` に保存されます。
Codex CLI へ `codex login` 済みであれば、ChatGPT subscription 認証を使って翻訳・質問を
実行します。ブラウザは Codex App Server に接続せず、Next.js backend が localhost の
stdio transport で子プロセスを起動します。

LAN 全体へ公開せず、Tailscale IP のみに bind する例:

```bash
npm run dev -- --hostname "$(tailscale ip -4)"
```

設計・調査結果は [docs/architecture.md](docs/architecture.md) を参照してください。
