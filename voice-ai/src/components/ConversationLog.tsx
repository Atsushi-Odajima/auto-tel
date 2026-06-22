import { useEffect, useRef } from 'react'
import type { LogEntry } from '../types'

interface Props {
  entries: LogEntry[]
  interim: string
}

export function ConversationLog({ entries, interim }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries, interim])

  return (
    <div className="log" role="log" aria-live="polite">
      {entries.map((e) => (
        <div key={e.id} className={`bubble bubble--${e.role}`}>
          <span className="bubble__role">
            {e.role === 'user' ? 'あなた' : 'AI'}
          </span>
          <p className="bubble__text">{e.content}</p>
        </div>
      ))}
      {interim && (
        <div className="bubble bubble--user bubble--interim">
          <span className="bubble__role">あなた</span>
          <p className="bubble__text">{interim}</p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
