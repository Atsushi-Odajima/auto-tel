/**
 * speechSynthesis による日本語(ja-JP)読み上げ。
 *
 * iOS 対策:
 *  - 初回ユーザータップ時に空の発話を投げて音声出力をアンロックする。
 *    これをしないと iOS では後続の speak() が無音になることがある。
 */

let unlocked = false

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * 初回ユーザージェスチャ内で必ず呼ぶ。空 utterance を投げて iOS のオーディオを解放する。
 */
export function unlockTts(): void {
  if (unlocked || !isTtsSupported()) return
  try {
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    u.lang = 'ja-JP'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    // 音声リスト読み込みのトリガ（一部ブラウザは遅延ロード）
    window.speechSynthesis.getVoices()
    unlocked = true
  } catch {
    // 失敗してもアプリは続行可能
  }
}

function pickJapaneseVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  return (
    voices.find((v) => v.lang === 'ja-JP') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('ja'))
  )
}

export interface SpeakOptions {
  onStart?: () => void
  onEnd?: () => void
  onError?: (message: string) => void
}

/**
 * テキストを ja-JP で読み上げる。
 */
export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!isTtsSupported() || !text.trim()) {
    opts.onEnd?.()
    return
  }
  const synth = window.speechSynthesis
  synth.cancel()

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'ja-JP'
  utter.rate = 1.0
  utter.pitch = 1.0
  const voice = pickJapaneseVoice()
  if (voice) utter.voice = voice

  utter.onstart = () => opts.onStart?.()
  utter.onend = () => opts.onEnd?.()
  utter.onerror = (e) => {
    opts.onError?.(`読み上げエラー: ${e.error}`)
    opts.onEnd?.()
  }

  synth.speak(utter)
}

export function cancelSpeech(): void {
  if (isTtsSupported()) window.speechSynthesis.cancel()
}
