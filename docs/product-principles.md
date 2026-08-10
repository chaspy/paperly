# Paperly product principles

## 解決したいこと

Paperlyは英語論文を「英語のまま精読する」ためのアプリではない。次の学習ループを短くする
個人用Research Paper Readerである。

1. 論文を見つけて追加する
2. 日本語を中心に理解する
3. 必要なときだけ対応する英語原文を確認する
4. 分からない箇所を選択してAIに質問する
5. 自分の理解、問い、会話を論文に紐づけて残す

最重要の利用場面は、iPadを開き、論文を追加し、対訳を読み、本文をドラッグしてその場で
質問する流れである。機能数より、この一連の手触りを優先する。

## MVPの判断基準

- Readerが主役。Chatや管理UIが本文を邪魔しないこと。
- 日本語訳だけを表示せず、原文との位置関係を常に保つこと。
- 図、表、数式、脚注、参照を翻訳のために壊さないこと。
- AI回答では「論文に書かれていること」と「AIの解釈・一般知識」を区別すること。
- 論文本文の選択箇所と周辺文脈を質問へ渡すこと。
- paywallを回避しない。合法的に取得できないPDFはuploadを求めること。
- 個人用Mac Studioで理解・復旧できる単純さを保つこと。

## 技術上の原則

- Responsive Web/PWAを第一候補とし、iPadとiPhoneを実機基準にする。
- Next.jsの単一backend、SQLite、local filesystemで始める。
- Codex App Serverはlocalhost/stdioだけで使う。Browserから直接接続しない。
- ChatGPT subscription認証を利用し、Paperlyは認証tokenを保存しない。
- PDF原本は不変で保持し、派生した対訳PDFを再生成可能なcacheとして扱う。
- 外部サービスの有料subscriptionやOpenAI API従量課金を必須にしない。
- Research Mapは将来の通常テーブル追加で拡張し、MVPにGraph DBを持ち込まない。

## 今は作らないもの

検索、タグ、collection、citation graph、Zotero/Obsidian連携、Researcher/Concept/Research
Questionの知識グラフ、高度な共同編集、クラウドdeployはMVP外とする。

## 将来への接続

Paper、DocumentBlock、Highlight、Conversationの安定したIDを起点に、将来はResearcher、
Concept、Research Question、Citationをrelation tableで追加できる。現在のReader体験を犠牲にして
先回り実装しない。
