# 別PCへの引き継ぎ手順

## Gitから復元できるもの

- アプリ本体、DB migration、テスト
- architectureとproduct principles
- 継続開発用Codex prompt

次のMacで対象branchをcheckoutする。

```bash
git clone git@github.com:chaspy/paperly.git
cd paperly
git switch agent/build-paperly-mvp
npm ci
uv tool install --python 3.12 BabelDOC==0.6.4
codex login
cp .env.example .env.local
npm test
npm run lint
npm run build
```

Codex CLIはApp Serverの仕様変更があり得るため、まずREADME記載の動作確認版を使い、更新時は
公式仕様と `lib/codex.ts` の互換性を確認する。BabelDOCも再現性のためversionを固定する。

## 個人データを移す

`data/` にはSQLite DB、原本PDF、BabelDOCの生成物が入る。Gitにはcommitしない。
Paperlyを両方のMacで停止してから、Tailscale/SSH経由でディレクトリごとコピーする。

新しいMacで、リポジトリ直下から実行する例:

```bash
rsync -av --progress \
  old-mac:/absolute/path/to/paperly/data/ \
  ./data/
```

SQLiteのWALを含む不整合を避けるため、起動中のコピーは行わない。より安全に運ぶ場合は旧Macで
停止後に `data/` をarchiveまたは暗号化backupし、個人用storageで転送する。論文と会話を含むため、
公開repositoryや共有bucketへ置かない。

データを移さない場合でもアプリは空のLibraryとして起動し、論文を再追加できる。翻訳済みPDFを
移さなければ、初回閲覧時に時間をかけて再生成される。初期4論文の公開URLは
`seed/papers.json` に保存しているため、Paperly起動後に次のコマンドで再取得できる。

```bash
npm run restore:library
```

別のURLで起動している場合は `PAPERLY_URL=http://<tailscale-ip>:3000 npm run restore:library` とする。
同じsource URLがLibraryにある論文はskipする。PDFが公開されていない論文はmetadataのみ復元され、
PDF upload待ちになる。manifestには公開情報だけを置き、読書状態、Highlight、Note、Chat履歴は置かない。

## 起動

localだけで確認する:

```bash
npm run dev -- --hostname 127.0.0.1
```

Tailscale内の端末から読む:

```bash
npm run dev -- --hostname "$(tailscale ip -4)"
```

macOS firewallとTailscale ACLも利用し、`0.0.0.0` へbindしない。Codex App ServerはPaperly
backendがstdio子プロセスとして起動し、network interfaceには公開しない。

## 動作確認

1. Libraryに既存論文が表示される。
2. 論文を開くと、原文と日本語が左右に並ぶ対訳PDFが表示される。
3. PDF本文をドラッグすると画面下部に `Ask AI` が現れる。
4. 質問を送ると右側Chatへ回答が入り、再読み込み後も会話が残る。
5. iPad SafariからTailscale IPで同じ操作ができる。

## 2026-08-10時点の現在地

- URL、PDF URL、uploadからPaperを保存できる。
- arXiv、PMC、PubMed/DOI系metadataを可能な範囲で取得する。
- BabelDOC 0.6.4でlayout-preservingな日英対訳PDFを生成・cacheする。
- react-pdfのtext layerで選択し、選択文と文脈をPaper Chatへ送れる。
- Paperごとの会話、highlight/note用API、reading statusをSQLiteへ保存する。
- 4本の初期論文は旧Macのlocal `data/` にあり、Gitには含まれない。

## 既知の制約と次に確認すること

- iPad Safariで長押し・選択ハンドル操作後にも `Ask AI` が確実に出るか、実機確認が必要。
- 現在の質問contextは抽出済みDocumentBlockから広めに取得しており、選択位置の直前直後へ厳密には
  anchorしていない。
- 全pageを一度にrenderするため、長い論文ではmemoryと初期表示速度を改善する余地がある。
- 翻訳生成は論文によって数十分かかる。進捗表示、job化、中断・再開は未実装。
- BabelDOC生成PDFの日本語品質とレイアウトは原稿形式に依存する。

優先順位は、まずiPadでの選択→質問をdogfoodingし、次にselection anchorと長文PDFのlazy renderを
直すこと。Research Mapなどの機能追加はその後にする。
