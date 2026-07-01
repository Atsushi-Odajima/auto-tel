// Supabase Edge Function: stt
// 録音音声(multipart/form-data の file)を受け取り、Whisper で文字起こしして
// {text} を返す。秘密鍵 OPENAI_API_KEY はサーバー側にのみ置く。
//
// 後で Groq 等の OpenAI 互換エンドポイントに差し替えやすいよう、
// エンドポイントとモデルは環境変数で上書き可能にしている。
//   - STT_API_URL   (default: https://api.openai.com/v1/audio/transcriptions)
//   - STT_MODEL     (default: whisper-1)
//   - STT_API_KEY   (未設定時は OPENAI_API_KEY を使用)
//
// 例: Groq に差し替える場合
//   supabase secrets set STT_API_URL=https://api.groq.com/openai/v1/audio/transcriptions
//   supabase secrets set STT_MODEL=whisper-large-v3
//   supabase secrets set STT_API_KEY=gsk_xxxx
//
// デプロイ:
//   supabase functions deploy stt --no-verify-jwt
//   supabase secrets set OPENAI_API_KEY=sk-xxxx

const DEFAULT_URL = 'https://api.openai.com/v1/audio/transcriptions'
const DEFAULT_MODEL = 'whisper-1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST のみ対応しています。' }, 405)
  }

  const apiKey = Deno.env.get('STT_API_KEY') ?? Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY (または STT_API_KEY) が未設定です。' }, 500)
  }
  const apiUrl = Deno.env.get('STT_API_URL') ?? DEFAULT_URL
  const model = Deno.env.get('STT_MODEL') ?? DEFAULT_MODEL

  let file: File | null = null
  try {
    const form = await req.formData()
    const f = form.get('file')
    if (f instanceof File) file = f
  } catch {
    return json({ error: 'multipart/form-data の解析に失敗しました。' }, 400)
  }

  if (!file) {
    return json({ error: '音声ファイル(file)が必要です。' }, 400)
  }
  if (file.size === 0) {
    return json({ error: '音声ファイルが空です。' }, 400)
  }

  try {
    const upstreamForm = new FormData()
    upstreamForm.append('file', file, file.name || 'audio.webm')
    upstreamForm.append('model', model)
    upstreamForm.append('language', 'ja')
    upstreamForm.append('response_format', 'json')

    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      return json(
        { error: `STT API エラー (${upstream.status}): ${detail}` },
        502,
      )
    }

    const data = await upstream.json()
    const text: string = (data?.text ?? '').toString().trim()
    return json({ text })
  } catch (e) {
    return json(
      { error: `サーバーエラー: ${e instanceof Error ? e.message : String(e)}` },
      500,
    )
  }
})
