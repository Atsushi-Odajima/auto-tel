// Supabase Edge Function: chat
// Claude(Anthropic /v1/messages)へのプロキシ。
// フロントから {messages:[{role,content}...]} を受け取り、返答テキストを返す。
// 秘密鍵 ANTHROPIC_API_KEY はこのサーバー側にのみ置く（フロントには出さない）。
//
// デプロイ:
//   supabase functions deploy chat --no-verify-jwt
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxx

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `あなたは「親しみやすい日本語の案内役」です。
- いつも丁寧で温かく、フレンドリーな日本語で話します。
- 音声で読み上げられることを前提に、簡潔で聞き取りやすい短めの文章で答えます。
- 箇条書きや記号の羅列は避け、自然な話し言葉で応答します。
- わからないことは正直に伝え、相手が次に何をすればよいかを優しく案内します。`

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

interface InMessage {
  role: 'user' | 'assistant'
  content: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST のみ対応しています。' }, 405)
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY が未設定です。' }, 500)
  }

  let messages: InMessage[]
  try {
    const body = await req.json()
    messages = body?.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages 配列が必要です。' }, 400)
    }
  } catch {
    return json({ error: 'リクエストボディの JSON が不正です。' }, 400)
  }

  // Anthropic 仕様に合わせて整形（role と content のみ通す）
  const cleaned = messages
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim() !== '',
    )
    .map((m) => ({ role: m.role, content: m.content }))

  if (cleaned.length === 0) {
    return json({ error: '有効なメッセージがありません。' }, 400)
  }

  try {
    const upstream = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: cleaned,
      }),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      return json(
        { error: `Anthropic API エラー (${upstream.status}): ${detail}` },
        502,
      )
    }

    const data = await upstream.json()
    const reply: string =
      Array.isArray(data?.content) && data.content.length > 0
        ? data.content
            .filter((b: { type?: string }) => b?.type === 'text')
            .map((b: { text?: string }) => b.text ?? '')
            .join('')
            .trim()
        : ''

    if (!reply) {
      return json({ error: 'Claude から空の応答が返りました。' }, 502)
    }

    return json({ reply })
  } catch (e) {
    return json(
      { error: `サーバーエラー: ${e instanceof Error ? e.message : String(e)}` },
      500,
    )
  }
})
