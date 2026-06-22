# SETUP — 朝の作業手順

このファイルは、音声対話AIアプリ `voice-ai` を実際に動かすために
**あなたが朝に行う作業**と、実装時に**置いた前提**をまとめたものです。

---

## 0. 必要なもの

- Node.js 18+ / npm（開発済み環境では Node 22 で動作確認済み）
- [Supabase アカウント](https://supabase.com/) と Supabase CLI
- Anthropic API キー（`ANTHROPIC_API_KEY`）
- OpenAI API キー（`OPENAI_API_KEY`、Whisper 用）
- Cloudflare アカウント（Pages デプロイ用）

> 🔑 秘密鍵（Anthropic / OpenAI）は**フロントには絶対に出しません**。
> すべて Supabase Edge Function 側の Secrets として登録します。

---

## 1. Supabase プロジェクトの準備

1. Supabase ダッシュボードで新規プロジェクトを作成。
2. Supabase CLI をインストール（未導入なら）:
   ```bash
   npm install -g supabase
   # または: brew install supabase/tap/supabase
   ```
3. ログインしてプロジェクトを紐づけ:
   ```bash
   cd voice-ai
   supabase login
   supabase link --project-ref <あなたの project-ref>
   ```
   - `project-ref` は Supabase の Project Settings → General で確認できます。

---

## 2. Edge Function 2本のデプロイ

関数コードは `supabase/functions/` に用意済みです（`chat`, `stt`）。

1. **シークレット（秘密鍵）を登録**:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
   supabase secrets set OPENAI_API_KEY=sk-xxxxxxxx
   ```
   - （任意）STT を Groq 等に差し替える場合:
     ```bash
     supabase secrets set STT_API_URL=https://api.groq.com/openai/v1/audio/transcriptions
     supabase secrets set STT_MODEL=whisper-large-v3
     supabase secrets set STT_API_KEY=gsk_xxxxxxxx
     ```

2. **デプロイ**:
   ```bash
   supabase functions deploy chat --no-verify-jwt
   supabase functions deploy stt  --no-verify-jwt
   ```
   - `--no-verify-jwt` は公開アプリ用（`supabase/config.toml` でも `verify_jwt = false` を設定済み）。

3. デプロイ後の関数 URL は次の形式です:
   ```
   https://<project-ref>.functions.supabase.co/chat
   https://<project-ref>.functions.supabase.co/stt
   ```

---

## 3. 必要な環境変数（フロント）

`.env.example` をコピーして `.env` を作成し、値を埋めます:

```bash
cp .env.example .env
```

| 変数 | 説明 |
| --- | --- |
| `VITE_FUNCTIONS_BASE_URL` | `https://<project-ref>.functions.supabase.co` |
| `VITE_CHAT_FUNCTION` | `chat`（変更不要） |
| `VITE_STT_FUNCTION` | `stt`（変更不要） |
| `VITE_SUPABASE_ANON_KEY` | Supabase の anon public key（Project Settings → API） |

> anon key は**公開キー**なのでフロントに置いてOKです。
> Anthropic / OpenAI の秘密鍵は **Supabase Secrets 側のみ**で、`.env` には書きません。

---

## 4. ローカル起動

```bash
cd voice-ai
npm install      # 初回のみ
npm run dev
```

- 開発サーバ: `http://localhost:5173`
- **注意**: マイク・音声認識は **HTTPS か localhost** でのみ動作します。
  - localhost は OK。
  - スマホ実機で試す場合は HTTPS が必要（Cloudflare Pages のプレビュー URL を使うのが簡単）。

### （任意）Edge Function をローカルで動かす場合
```bash
supabase functions serve --env-file ./supabase/.env.local
# .env の VITE_FUNCTIONS_BASE_URL を http://localhost:54321/functions/v1 に変更
```
`supabase/.env.local` に `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` を記載します（このファイルはコミットしないこと）。

---

## 5. Cloudflare Pages デプロイ

1. このリポジトリを GitHub に push（`voice-ai` を含む）。
2. Cloudflare ダッシュボード → **Workers & Pages → Create → Pages → Connect to Git**。
3. ビルド設定:
   | 項目 | 値 |
   | --- | --- |
   | Framework preset | `Vite`（または None） |
   | Root directory | `voice-ai` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
4. **環境変数**（Settings → Environment variables）に、上記「3. 環境変数（フロント）」の
   `VITE_*` を登録（`VITE_` 付きはビルド時に埋め込まれます）。
5. デプロイ。発行された HTTPS URL でスマホからアクセス可能になります（PWA としてホーム追加可）。

---

## 6. 動作確認チェックリスト

- [ ] Android / PC Chrome: マイクタップ → 「聞き取り中」→ 話す → 自動で「考え中」→「話し中」。
- [ ] iPhone (Safari/Chrome): マイクタップ → 録音 → **発話後5秒無音で自動送信**（または手動で再タップ停止）→ STT 経由で文字起こし → 応答。
- [ ] 返答が日本語で読み上げられる（iOS は初回タップでオーディオがアンロックされる）。
- [ ] 会話ログが画面に履歴表示される。

---

## 実装時に置いた前提（記録）

判断が必要だった箇所は、以下の妥当な前提を置いて進めました。

1. **フォルダ構成**: リポジトリ直下に `voice-ai/` を新規作成し、その中に全構築。
2. **スタック**: React 18 + Vite 5 + TypeScript 5。PWA は `vite-plugin-pwa`（`registerType: autoUpdate`）。
3. **Edge Function 名**: `chat`（Claude プロキシ）と `stt`（Whisper）。`verify_jwt = false`（公開アプリ）。
4. **認証**: Edge Function 呼び出しに Supabase anon key を任意で付与（`VITE_SUPABASE_ANON_KEY` があれば送る／無くても動く設計）。
5. **Claude**: モデル `claude-haiku-4-5`、`anthropic-version: 2023-06-01`、`max_tokens: 1024`。system プロンプトで「親しみやすい日本語の案内役」ペルソナを定義。
6. **会話履歴**: フロントが messages 配列を保持して送信。Anthropic 仕様に合わせ、先頭の assistant 発話（挨拶）は API 送信前に除外。
7. **STT**: OpenAI `whisper-1` をデフォルト。`STT_API_URL` / `STT_MODEL` / `STT_API_KEY` の環境変数で **Groq 等へ差し替え可能**な構造。`language=ja` 指定。
8. **STT 入力切替**: `window.SpeechRecognition || window.webkitSpeechRecognition` をフィーチャー判定。対応時は Web Speech API（`ja-JP`）、非対応時（iOS）は `MediaRecorder` 録音 → `stt` 関数へ送信。**自動切替**。
9. **録音 MIME**: `MediaRecorder.isTypeSupported` で選択。iOS は `audio/mp4`、Chrome は `audio/webm`。Blob の MIME から拡張子を決めて STT へ渡す（Whisper は拡張子で形式判定）。
10. **TTS**: `speechSynthesis` の `ja-JP` 音声で読み上げ。**初回ユーザータップ時に空 utterance を投げて iOS のオーディオをアンロック**。
11. **波形可視化**: 録音フォールバック時は Web Audio API の AnalyserNode で実測音量を反映。Web Speech 時はマイクストリームを取得しないため、状態ベースの擬似アニメで可視化。
11b. **無音自動停止(VAD)**: 録音(iOS)経路では、一度発話を検出した後に **5秒(`SILENCE_MS`)** 無音が続くと自動で録音停止→STT送信。手動の再タップ停止も併用可能。しきい値は `useVoiceChat.ts` の `SILENCE_MS` / `SPEECH_RMS_THRESHOLD` で調整可。
12. **状態管理**: 状態（待機 / 聞き取り中 / 考え中 / 話し中）と全処理フローを `useVoiceChat` カスタムフックに集約。
13. **アイコン**: アプリアイコン（`public/icon-192.png` / `icon-512.png`）はビルド時に困らないようプレースホルダを `scripts/generate-icons.mjs` で自動生成済み。差し替え自由。
14. **デプロイ先**: Cloudflare Pages（Root: `voice-ai`、Build: `npm run build`、Output: `dist`）を想定。HTTPS 前提。
15. **ビルド**: `npm install` 済み、`npm run build`（`tsc -b && vite build`）がエラーなく通ることを確認済み。

---

## トラブルシュート

- **マイクが反応しない**: HTTPS か localhost で開いているか確認。ブラウザのマイク権限を許可。
- **iOS で音が出ない**: 一度マイクボタンをタップしてから（アンロック後に）応答が読み上げられます。
- **`chat 関数エラー (500)`**: Supabase に `ANTHROPIC_API_KEY` が未登録。`supabase secrets set` を確認。
- **`stt 関数エラー (500)`**: `OPENAI_API_KEY`（または `STT_API_KEY`）が未登録。
- **CORS エラー**: 関数は `*` 許可済み。`--no-verify-jwt` でデプロイしたか確認。
