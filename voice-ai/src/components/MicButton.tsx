import type { VoiceState } from '../types'

interface Props {
  state: VoiceState
  onToggle: () => void
}

function label(state: VoiceState): string {
  switch (state) {
    case 'idle':
      return 'タップして話す'
    case 'listening':
      return 'タップで停止'
    case 'thinking':
      return '考えています…'
    case 'speaking':
      return 'タップで停止'
  }
}

export function MicButton({ state, onToggle }: Props) {
  const disabled = state === 'thinking'
  return (
    <div className="mic">
      <button
        type="button"
        className={`mic__button mic__button--${state}`}
        onClick={onToggle}
        disabled={disabled}
        aria-label={label(state)}
        aria-pressed={state === 'listening'}
      >
        <span className="mic__pulse" aria-hidden="true" />
        <MicIcon />
      </button>
      <p className="mic__hint">{label(state)}</p>
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      className="mic__icon"
      viewBox="0 0 24 24"
      width="48"
      height="48"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" />
      <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z" />
    </svg>
  )
}
