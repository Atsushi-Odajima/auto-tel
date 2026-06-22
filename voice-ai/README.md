# 音声対話AI (voice-ai)

親しみやすい日本語の案内役と音声で会話できる PWA。
**React + Vite + TypeScript**、頭脳は **Claude (Haiku)**、文字起こしは **Whisper**。
秘密鍵はすべて **Supabase Edge Function** の裏側に置き、フロントには出しません。

## 特長

- 🎙️ 中央の大きなマイクボタンでタップ録音。状態を「待機 / 聞き取り中 / 考え中 / 話し中」で表示、波形アニメで可視化。
- 📱 **iPhone 対応最優先**: Web Speech API 非対応の iOS では自動で `MediaRecorder` 録音 → サーバー文字起こしに切替。
- 🔊 `speechSynthesis`（ja-JP）で読み上げ。iOS のオーディオアンロック対応済み。
- 💬 会話履歴を画面表示し、文脈を保持して Claude に送信。
- ⚙️ 状態と処理フローは `useVoiceChat` フックに集約。

## クイックスタート

```bash
npm install
cp .env.example .env   # 値を埋める（SETUP.md 参照）
npm run dev
```

## 構成

```
voice-ai/
├── src/
│   ├── hooks/useVoiceChat.ts     # 状態・処理フローの中枢
│   ├── lib/{api,recorder,webSpeech,tts}.ts
│   ├── components/{MicButton,Waveform,StatusIndicator,ConversationLog}.tsx
│   └── App.tsx
└── supabase/functions/
    ├── chat/index.ts             # Claude プロキシ (claude-haiku-4-5)
    └── stt/index.ts              # Whisper 文字起こし (whisper-1, Groq 等に差替可)
```

デプロイと運用の手順は **[SETUP.md](./SETUP.md)** を参照してください。
