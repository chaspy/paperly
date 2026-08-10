# Paperly MVP architecture

## 判断

- Next.js の単一プロセスにUIとbackendを置き、SQLiteとlocal filesystemへ保存する。
- Browser → Paperly backend → `codex app-server --listen stdio://` の一方向だけを許す。
  App ServerをTCP公開しない。プロトコル差分は `lib/codex.ts` に閉じ込める。
- PDFは原本を保持し、BabelDOCでレイアウト、図表、数式を維持した左右対訳PDFを生成する。
  `DocumentBlock` はAI質問の文脈・将来の選択アンカー用に並行して保持する。
- 翻訳と質問は別のCodex threadにする。Paper Chatだけthread idを保存して会話を継続する。
- 外部URL取得はhttp(s)のみ、private/loopback/link-local宛を拒否し、paywall回避はしない。

## PDF処理の調査

PyMuPDFは位置付きblock抽出を提供する一方、PDF内の格納順と読順が一致しない場合がある。
GROBIDは段落、見出し、図表、数式、参照をTEIとして構造化できるが、Java serviceの常駐が増える。
MVPはpdf.jsによる位置付きblock抽出を採用し、`DocumentExtractor` 境界を将来GROBIDへ交換する。

BabelDOC 0.6.4を対訳PDF生成に採用する。BabelDOCのOpenAI互換translator interfaceへ、実行中だけ
localhostにbindする一時gatewayを接続し、その先でCodex App Serverをstdio起動する。これにより
ChatGPT subscription認証を利用しつつ、tokenやgatewayをbrowserへ公開しない。

参考:

- https://pymupdf.readthedocs.io/en/latest/recipes-text.html
- https://grobid.readthedocs.io/en/latest/training/fulltext/
- https://github.com/funstory-ai/BabelDOC
- https://github.com/Byaidu/PDFMathTranslate

## データモデル

`papers`、`document_blocks`、`highlights`、`conversations`、`messages` をSQLiteに置く。
将来のResearch Mapは既存IDを外部キーにする通常のrelation tableで追加し、Graph DBは導入しない。

## レスポンシブ方針

- Desktop/iPad landscape: BabelDOC対訳PDFをページ幅で表示し、Chatは右side panel。
- iPad portrait/iPhone: 同じ対訳PDFをpinch zoom可能なPDF viewerで表示。Chatは全画面drawer。
- 選択toolbarは画面下部へ固定し、Safariの選択UIと競合しにくくする。

## App Server互換性

Codex CLI 0.147.0で `stdio://`、`initialize`、`thread/start`、`thread/resume`、`turn/start`、
`item/agentMessage/delta`、`turn/completed` を確認した。専用の公式仕様ページは発見できなかったため、
起動時のinitializeを必須にし、JSON-RPC処理を一箇所に限定する。ChatGPT認証はCodex CLIの既存loginを
使用し、Paperlyはtokenを保存しない。
