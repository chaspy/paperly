# Paperly継続開発プロンプト

このrepositoryの個人用Research Paper Reader「Paperly」の開発を引き継いでください。

最初に `README.md`、`docs/product-principles.md`、`docs/architecture.md`、
`docs/handoff.md` を最後まで読み、`git status`、現在branch、直近commit、利用可能なlocal dataを
確認してください。現在の実装を捨てて作り直さず、既存のvertical sliceをdogfoodingして、読書体験を
一段ずつ改善してください。

Paperlyの目的は、英語論文を英語のまま精読することではありません。

「論文を読む → 日本語で理解する → 対応する原文を確認する → 分からない箇所をAIに質問する →
自分の理解や問いを論文に紐づけて蓄積する」

という学習ループを、特にiPadで気持ちよく回すことが目的です。Readerを主役にし、通常は左に原文、
右に日本語が最初から見えるようにします。本文をドラッグして、そのまま `Ask AI` できることを最優先
してください。Chatはdesktop/iPad landscapeでは右side panel、iPhoneではdrawer/separate viewとし、
本文を邪魔しないようにします。

守るべき境界:

- BrowserからCodex App Serverへ直接接続しない。
- Paperly backendからlocalhost/stdioのCodex App Serverだけを使う。
- ChatGPT subscription認証を使い、OpenAI API従量課金を前提にしない。
- PDF原本、図、表、数式を壊さない。paywallを回避しない。
- SQLite、local filesystem、単一backendを維持し、MVPを過剰設計しない。
- AI回答では論文由来の記述とAIの解釈・一般知識を可能な限り区別する。
- Research Map、Graph DB、Zotero/Obsidian連携はReaderのdogfooding後まで実装しない。

現在のvertical sliceは、Paper追加 → BabelDOC対訳PDF生成 → react-pdf表示 → 本文選択 → Ask AI →
Paperごとの会話保存まで実装済みです。`docs/handoff.md` の「既知の制約」を現在地として扱って
ください。まずiPad Safariで本文選択が実用になるかを確認し、再現する問題があれば原因を特定して
最小修正し、test/lint/buildと実論文で検証してください。

実装前に大きな不確実性がなければ確認待ちにせず進めてください。ただし設計思想を変える判断、
データを破壊する操作、外部課金やpublic公開を伴う操作は勝手に行わないでください。作業後は変更理由と
検証結果を日本語で文書化し、Conventional Commitsでcommitしてbranchへpushしてください。
