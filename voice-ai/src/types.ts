export type Role = 'user' | 'assistant'

export interface ChatMessage {
  role: Role
  content: string
}

export interface LogEntry extends ChatMessage {
  id: string
  createdAt: number
}

/**
 * 会話・処理フローの状態。
 * - idle:      待機
 * - listening: 聞き取り中（録音 / 音声認識中）
 * - thinking:  考え中（Claude 応答待ち、STT 文字起こし中）
 * - speaking:  話し中（TTS 読み上げ中）
 */
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking'

export const STATE_LABEL: Record<VoiceState, string> = {
  idle: '待機',
  listening: '聞き取り中',
  thinking: '考え中',
  speaking: '話し中',
}
