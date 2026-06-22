import type { ChatMessage } from '../types'

const BASE = import.meta.env.VITE_FUNCTIONS_BASE_URL?.replace(/\/$/, '') ?? ''
const CHAT_FN = import.meta.env.VITE_CHAT_FUNCTION ?? 'chat'
const STT_FN = import.meta.env.VITE_STT_FUNCTION ?? 'stt'
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

function fnUrl(name: string): string {
  if (!BASE) {
    throw new Error(
      'VITE_FUNCTIONS_BASE_URL が未設定です。.env を確認してください。',
    )
  }
  return `${BASE}/${name}`
}

function authHeaders(): Record<string, string> {
  // Supabase Edge Function は anon key による Authorization を要求することがある。
  // 秘密鍵ではなく公開 anon key なのでフロントに置いてよい。
  if (!ANON_KEY) return {}
  return {
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
  }
}

/**
 * Claude プロキシ(Edge Function `chat`)を呼び、アシスタントの返答テキストを得る。
 */
export async function callChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch(fnUrl(CHAT_FN), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ messages }),
  })

  if (!res.ok) {
    const detail = await safeText(res)
    throw new Error(`chat 関数エラー (${res.status}): ${detail}`)
  }

  const data = (await res.json()) as { reply?: string; error?: string }
  if (data.error) throw new Error(data.error)
  if (!data.reply) throw new Error('chat 関数から reply が返りませんでした。')
  return data.reply
}

/**
 * 録音音声(Blob)を STT 用 Edge Function `stt` に送り、文字起こしテキストを得る。
 * MIME に応じた拡張子でファイル名を付ける（Whisper は拡張子で形式を判定するため）。
 */
export async function callStt(blob: Blob): Promise<string> {
  const ext = extForMime(blob.type)
  const form = new FormData()
  form.append('file', blob, `audio.${ext}`)

  const res = await fetch(fnUrl(STT_FN), {
    method: 'POST',
    headers: {
      // FormData の場合 Content-Type はブラウザに任せる（boundary 付与のため）
      ...authHeaders(),
    },
    body: form,
  })

  if (!res.ok) {
    const detail = await safeText(res)
    throw new Error(`stt 関数エラー (${res.status}): ${detail}`)
  }

  const data = (await res.json()) as { text?: string; error?: string }
  if (data.error) throw new Error(data.error)
  return (data.text ?? '').trim()
}

function extForMime(mime: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4'
  if (m.includes('webm')) return 'webm'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  return 'webm'
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return res.statusText
  }
}
