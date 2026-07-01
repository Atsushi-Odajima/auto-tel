import { useEffect, useRef } from 'react'
import type { VoiceState } from '../types'

interface Props {
  state: VoiceState
  level: number // 0..1（録音時の実測。Web Speech 時は 0 になりうる）
}

const BARS = 28

/**
 * 状態と音量レベルに応じて動く波形ビジュアライザ。
 * - listening: 音量(level)に反応。level=0 の環境では擬似的に揺らす。
 * - thinking:  ゆっくりした脈動
 * - speaking:  軽快な波
 * - idle:      静止
 */
export function Waveform({ state, level }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const levelRef = useRef(level)
  const tRef = useRef(0)

  useEffect(() => {
    levelRef.current = level
  }, [level])

  useEffect(() => {
    const container = ref.current
    if (!container) return
    const bars = Array.from(
      container.querySelectorAll<HTMLSpanElement>('.wf-bar'),
    )

    const animate = () => {
      tRef.current += 0.08
      const t = tRef.current
      const lv = levelRef.current

      bars.forEach((bar, i) => {
        let h = 0.08 // idle の最小高さ（比率）
        const phase = i / BARS
        if (state === 'listening') {
          const base = lv > 0.02 ? lv : 0.18 + 0.12 * Math.sin(t * 2)
          h = Math.max(
            0.08,
            base * (0.5 + 0.5 * Math.sin(t * 4 + phase * Math.PI * 4)),
          )
        } else if (state === 'thinking') {
          h = 0.15 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.6 + phase * Math.PI * 2))
        } else if (state === 'speaking') {
          h =
            0.2 +
            0.5 *
              Math.abs(
                Math.sin(t * 3 + phase * Math.PI * 6) *
                  Math.cos(t * 1.3 + phase * Math.PI * 2),
              )
        }
        bar.style.transform = `scaleY(${Math.max(0.06, Math.min(1, h))})`
      })

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [state])

  return (
    <div className={`waveform waveform--${state}`} ref={ref} aria-hidden="true">
      {Array.from({ length: BARS }).map((_, i) => (
        <span className="wf-bar" key={i} />
      ))}
    </div>
  )
}
