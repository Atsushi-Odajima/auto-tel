/**
 * Web Speech API(SpeechRecognition)のラッパー。
 * Android/PC Chrome 等で利用可能。iOS Safari/Chrome は非対応。
 */

export function getSpeechRecognitionCtor():
  | typeof SpeechRecognition
  | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

export function isWebSpeechSupported(): boolean {
  return getSpeechRecognitionCtor() !== undefined
}

export interface WebSpeechHandle {
  stop: () => void
  abort: () => void
}

export interface WebSpeechCallbacks {
  onInterim?: (text: string) => void
  onFinal: (text: string) => void
  onError: (message: string) => void
  onEnd?: () => void
}

/**
 * 音声認識を開始する。最終結果は onFinal に渡る。
 */
export function startWebSpeech(cb: WebSpeechCallbacks): WebSpeechHandle | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null

  const recognition = new Ctor()
  recognition.lang = 'ja-JP'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.maxAlternatives = 1

  let finalText = ''

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const transcript = result[0]?.transcript ?? ''
      if (result.isFinal) finalText += transcript
      else interim += transcript
    }
    if (interim) cb.onInterim?.(interim)
  }

  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    // no-speech / aborted はユーザー操作の範囲なので致命的扱いにしない
    if (event.error === 'no-speech') {
      cb.onError('音声が聞き取れませんでした。もう一度お試しください。')
    } else if (event.error === 'not-allowed') {
      cb.onError('マイクの使用が許可されていません。')
    } else if (event.error !== 'aborted') {
      cb.onError(`音声認識エラー: ${event.error}`)
    }
  }

  recognition.onend = () => {
    const text = finalText.trim()
    if (text) cb.onFinal(text)
    cb.onEnd?.()
  }

  recognition.start()

  return {
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  }
}
