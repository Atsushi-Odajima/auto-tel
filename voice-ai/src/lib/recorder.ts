/**
 * MediaRecorder ベースの録音ヘルパー。
 * iOS Safari/Chrome は Web Speech API 非対応のため、ここで録音して
 * STT 用 Edge Function に Blob を送る。
 *
 * MIME の事情:
 *  - iOS の MediaRecorder は audio/mp4 を出す
 *  - デスクトップ/Android Chrome は audio/webm を出す
 * isTypeSupported で対応形式を選び、Blob.type に反映させて
 * 後段(api.ts)が正しい拡張子で Whisper に渡せるようにする。
 */

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/mp4;codecs=mp4a.40.2',
  'audio/aac',
  'audio/ogg;codecs=opus',
]

export function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return undefined
}

export interface RecordingHandle {
  stop: () => Promise<Blob>
  cancel: () => void
  stream: MediaStream
  mimeType: string
}

/**
 * マイク録音を開始する。停止すると録音 Blob を解決する Promise を返す stop() を含む。
 */
export async function startRecording(): Promise<RecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = pickSupportedMimeType()
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream)

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  recorder.start()

  const stopTracks = () => {
    for (const track of stream.getTracks()) track.stop()
  }

  return {
    stream,
    mimeType: recorder.mimeType || mimeType || 'audio/webm',
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          stopTracks()
          const type = recorder.mimeType || mimeType || 'audio/webm'
          resolve(new Blob(chunks, { type }))
        }
        recorder.onerror = (e) => {
          stopTracks()
          reject((e as unknown as { error?: Error }).error ?? new Error('録音エラー'))
        }
        if (recorder.state !== 'inactive') recorder.stop()
        else resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
      }),
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } finally {
        stopTracks()
      }
    },
  }
}
