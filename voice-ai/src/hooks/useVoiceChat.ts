import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, LogEntry, VoiceState } from '../types'
import { callChat, callStt } from '../lib/api'
import {
  isWebSpeechSupported,
  startWebSpeech,
  type WebSpeechHandle,
} from '../lib/webSpeech'
import { startRecording, type RecordingHandle } from '../lib/recorder'
import { cancelSpeech, speak, unlockTts } from '../lib/tts'

export type InputMode = 'webspeech' | 'recorder'

const GREETING =
  'こんにちは！音声でお話しできる案内役です。下のマイクをタップして話しかけてくださいね。'

// 録音(iOS フォールバック)経路の VAD: この時間だけ無音が続いたら自動停止する。
const SILENCE_MS = 5000
// これ以上の音量(RMS)を「発話」とみなす無音判定のしきい値。
const SPEECH_RMS_THRESHOLD = 0.03

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Anthropic API は最初のメッセージが user である必要があるため、
 * 先頭の assistant 発話（挨拶など）は履歴から除外して送る。
 */
function buildApiMessages(log: LogEntry[]): ChatMessage[] {
  const msgs: ChatMessage[] = log.map(({ role, content }) => ({ role, content }))
  while (msgs.length > 0 && msgs[0].role === 'assistant') msgs.shift()
  return msgs
}

export interface UseVoiceChat {
  state: VoiceState
  log: LogEntry[]
  error: string | null
  interim: string
  audioLevel: number
  inputMode: InputMode
  toggleMic: () => void
  reset: () => void
  dismissError: () => void
}

export function useVoiceChat(): UseVoiceChat {
  const [state, setState] = useState<VoiceState>('idle')
  const [log, setLog] = useState<LogEntry[]>([
    { id: uid(), role: 'assistant', content: GREETING, createdAt: Date.now() },
  ])
  const [error, setError] = useState<string | null>(null)
  const [interim, setInterim] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)

  const inputMode: InputMode = isWebSpeechSupported() ? 'webspeech' : 'recorder'

  // --- refs for live handles ---
  const stateRef = useRef<VoiceState>('idle')
  const webSpeechRef = useRef<WebSpeechHandle | null>(null)
  const recorderRef = useRef<RecordingHandle | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const handledRef = useRef(false) // recorder: 二重処理防止

  // --- VAD(無音自動停止)用 ---
  const finishRecordingRef = useRef<(() => void) | null>(null)
  const speechDetectedRef = useRef(false) // 一度でも発話を検出したか
  const lastSoundAtRef = useRef(0) // 最後に音があった時刻(ms)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const stopLevelMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    setAudioLevel(0)
  }, [])

  const startLevelMeter = useCallback(
    (stream: MediaStream, vad = false) => {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!Ctx) return
        const ctx = new Ctx()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        const data = new Uint8Array(analyser.frequencyBinCount)

        // VAD 初期化（録音経路のみ）
        speechDetectedRef.current = false
        lastSoundAtRef.current = Date.now()

        const tick = () => {
          analyser.getByteTimeDomainData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          setAudioLevel(Math.min(1, rms * 3))

          // --- 無音自動停止(VAD) ---
          if (vad && stateRef.current === 'listening') {
            const now = Date.now()
            if (rms > SPEECH_RMS_THRESHOLD) {
              speechDetectedRef.current = true
              lastSoundAtRef.current = now
            }
            // 一度発話を検出した後、SILENCE_MS 無音が続いたら自動で停止
            if (
              speechDetectedRef.current &&
              now - lastSoundAtRef.current >= SILENCE_MS
            ) {
              finishRecordingRef.current?.()
              return // この後 stopLevelMeter で rAF は止まる
            }
          }

          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        // 可視化は失敗しても致命的でない
      }
    },
    [],
  )

  // --- 会話処理: ユーザー発話テキスト -> Claude -> TTS ---
  const processUserText = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) {
        setState('idle')
        return
      }

      const userEntry: LogEntry = {
        id: uid(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      }

      setState('thinking')
      // 最新ログを使って API メッセージを構築する
      let apiMessages: ChatMessage[] = []
      setLog((prev) => {
        const next = [...prev, userEntry]
        apiMessages = buildApiMessages(next)
        return next
      })

      try {
        const reply = await callChat(apiMessages)
        const botEntry: LogEntry = {
          id: uid(),
          role: 'assistant',
          content: reply,
          createdAt: Date.now(),
        }
        setLog((prev) => [...prev, botEntry])

        setState('speaking')
        speak(reply, {
          onEnd: () => {
            if (stateRef.current === 'speaking') setState('idle')
          },
          onError: (msg) => setError(msg),
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : '通信エラーが発生しました。')
        setState('idle')
      }
    },
    [],
  )

  // --- 録音(iOS フォールバック)停止 -> STT -> 会話処理 ---
  const finishRecording = useCallback(async () => {
    const handle = recorderRef.current
    if (!handle || handledRef.current) return
    handledRef.current = true
    recorderRef.current = null
    stopLevelMeter()
    setState('thinking')
    try {
      const blob = await handle.stop()
      if (blob.size === 0) {
        setError('録音が空でした。もう一度お試しください。')
        setState('idle')
        return
      }
      const text = await callStt(blob)
      if (!text) {
        setError('音声を聞き取れませんでした。もう一度お試しください。')
        setState('idle')
        return
      }
      await processUserText(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : '文字起こしに失敗しました。')
      setState('idle')
    }
  }, [processUserText, stopLevelMeter])

  // VAD(無音検知)から最新の finishRecording を呼べるよう ref に保持
  useEffect(() => {
    finishRecordingRef.current = () => void finishRecording()
  }, [finishRecording])

  // --- 聞き取り開始 ---
  const startListening = useCallback(async () => {
    setError(null)
    setInterim('')
    // iOS のオーディオアンロックは必ずユーザージェスチャ内で
    unlockTts()
    cancelSpeech()

    if (inputMode === 'webspeech') {
      setState('listening')
      const handle = startWebSpeech({
        onInterim: (t) => setInterim(t),
        onFinal: (t) => {
          setInterim('')
          void processUserText(t)
        },
        onError: (msg) => {
          setError(msg)
          setState('idle')
        },
        onEnd: () => {
          webSpeechRef.current = null
          // onFinal が無く終了した場合は待機に戻す
          if (stateRef.current === 'listening') setState('idle')
        },
      })
      if (!handle) {
        setError('音声認識を開始できませんでした。')
        setState('idle')
        return
      }
      webSpeechRef.current = handle
    } else {
      // MediaRecorder フォールバック
      try {
        handledRef.current = false
        const handle = await startRecording()
        recorderRef.current = handle
        startLevelMeter(handle.stream, true) // VAD 有効
        setState('listening')
      } catch (e) {
        setError(
          e instanceof Error
            ? `マイクを起動できませんでした: ${e.message}`
            : 'マイクを起動できませんでした。',
        )
        setState('idle')
      }
    }
  }, [inputMode, processUserText, startLevelMeter])

  // --- メインのトグル操作 ---
  const toggleMic = useCallback(() => {
    const current = stateRef.current
    if (current === 'idle') {
      void startListening()
      return
    }
    if (current === 'listening') {
      if (inputMode === 'webspeech') {
        // stop() で onend -> onFinal が発火し processUserText に繋がる
        webSpeechRef.current?.stop()
      } else {
        void finishRecording()
      }
      return
    }
    // thinking / speaking 中のタップは中断 -> 待機
    if (current === 'speaking') {
      cancelSpeech()
      setState('idle')
    }
    // thinking 中は応答待ち。中断せず無視（誤操作防止）
  }, [inputMode, startListening, finishRecording])

  const reset = useCallback(() => {
    webSpeechRef.current?.abort()
    webSpeechRef.current = null
    recorderRef.current?.cancel()
    recorderRef.current = null
    stopLevelMeter()
    cancelSpeech()
    setLog([
      { id: uid(), role: 'assistant', content: GREETING, createdAt: Date.now() },
    ])
    setInterim('')
    setError(null)
    setState('idle')
  }, [stopLevelMeter])

  const dismissError = useCallback(() => setError(null), [])

  // --- アンマウント時のクリーンアップ ---
  useEffect(() => {
    return () => {
      webSpeechRef.current?.abort()
      recorderRef.current?.cancel()
      cancelSpeech()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (audioCtxRef.current) void audioCtxRef.current.close().catch(() => {})
    }
  }, [])

  return {
    state,
    log,
    error,
    interim,
    audioLevel,
    inputMode,
    toggleMic,
    reset,
    dismissError,
  }
}
