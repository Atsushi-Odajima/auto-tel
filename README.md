# voice-ai — 日本語の音声対話AI

録音・文字起こし・AI応答・読み上げをつなぎ、会話の状態を画面で確認できる音声対話PWAです。

> **実装ブランチ：`claude/voice-chat-ai-app-kvqlw9`**。この既定ブランチのREADMEは製品の案内です。以下のソース・資料リンクと起動手順は、実装ブランチを参照します。

## できること

- 待機・聞き取り・思考・読み上げの状態表示と会話履歴
- Web Speech APIとMediaRecorderによる音声入力の切替
- Supabase Edge Functions経由のClaude応答とWhisper互換の文字起こし

## 現在の範囲・制限

- マイクにはlocalhostまたはHTTPSと、利用者による権限許可が必要です。ブラウザごとに録音・読み上げの挙動が異なります。
- 実際の会話にはSupabaseとAI / 文字起こしサービスの設定が必要です。音声・会話内容が送信先サービスへ渡る構成で、完全ローカル処理ではありません。

## 実装の見どころ

**構成：** React / TypeScript / Vite、Web Speech / MediaRecorder / speechSynthesis、Supabase Edge Functions。

- [voice-ai/src/hooks/useVoiceChat.ts](https://github.com/Atsushi-Odajima/auto-tel/blob/claude%2Fvoice-chat-ai-app-kvqlw9/voice-ai/src/hooks/useVoiceChat.ts)
- [voice-ai/src/lib](https://github.com/Atsushi-Odajima/auto-tel/tree/claude%2Fvoice-chat-ai-app-kvqlw9/voice-ai/src/lib)
- [voice-ai/supabase/functions](https://github.com/Atsushi-Odajima/auto-tel/tree/claude%2Fvoice-chat-ai-app-kvqlw9/voice-ai/supabase/functions)

## ローカルで試す

Node.jsとnpm。Supabaseプロジェクト、Claudeと文字起こしサービスのAPI設定。

実装ブランチを取得し、次のディレクトリで作業します。

```sh
git clone --branch claude/voice-chat-ai-app-kvqlw9 https://github.com/Atsushi-Odajima/auto-tel.git
cd auto-tel/voice-ai
npm install
```

SETUP.mdに沿って.envとEdge Functionsのサーバー側secretを設定・配備してから npm run dev を実行します。秘密鍵をVITE_変数へ入れないでください。

環境設定・初期化の詳細：[セットアップ手順](https://github.com/Atsushi-Odajima/auto-tel/blob/claude%2Fvoice-chat-ai-app-kvqlw9/voice-ai/SETUP.md)。

## 検証方法

`voice-ai/` の `package.json` に定義された主な確認コマンドです。DB・ブラウザ・外部ツールを要するものは、開発手順の事前設定が必要です。

```sh
npm run typecheck
npm run build
```

試験の実施環境・結果・未実施項目は、下記の記録を参照してください。画面エミュレーションと実機確認、モックと外部サービスでの確認を区別しています。

## 資料

- [voice-ai/SETUP.md](https://github.com/Atsushi-Odajima/auto-tel/blob/claude%2Fvoice-chat-ai-app-kvqlw9/voice-ai/SETUP.md)
- [voice-ai/README.md](https://github.com/Atsushi-Odajima/auto-tel/blob/claude%2Fvoice-chat-ai-app-kvqlw9/voice-ai/README.md)

## 制作・利用条件

制作・管理：**Atsushi Odajima**。実装・資料作成にはAI支援を利用しています。
ソース・同梱ライブラリ・フォント・モデル等の利用条件は、各ライセンスと第三者表記を参照してください。リポジトリの閲覧可能性と、再配布・商用利用の許諾は別です。
