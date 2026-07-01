import type { VoiceState } from '../types'
import { STATE_LABEL } from '../types'

interface Props {
  state: VoiceState
}

export function StatusIndicator({ state }: Props) {
  return (
    <div className={`status status--${state}`} role="status" aria-live="polite">
      <span className="status__dot" />
      <span className="status__label">{STATE_LABEL[state]}</span>
    </div>
  )
}
