import { useVoiceChat } from './hooks/useVoiceChat'
import { MicButton } from './components/MicButton'
import { StatusIndicator } from './components/StatusIndicator'
import { Waveform } from './components/Waveform'
import { ConversationLog } from './components/ConversationLog'
import './App.css'

export default function App() {
  const {
    state,
    log,
    error,
    interim,
    audioLevel,
    inputMode,
    toggleMic,
    reset,
    dismissError,
  } = useVoiceChat()

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">音声対話AI</h1>
        <button
          type="button"
          className="app__reset"
          onClick={reset}
          aria-label="会話をリセット"
        >
          リセット
        </button>
      </header>

      <main className="app__main">
        <ConversationLog entries={log} interim={interim} />
      </main>

      <section className="app__controls">
        {error && (
          <div className="alert" role="alert" onClick={dismissError}>
            <span>{error}</span>
            <button
              type="button"
              className="alert__close"
              aria-label="閉じる"
              onClick={dismissError}
            >
              ×
            </button>
          </div>
        )}

        <StatusIndicator state={state} />
        <Waveform state={state} level={audioLevel} />
        <MicButton state={state} onToggle={toggleMic} />

        <p className="app__mode">
          入力方式:{' '}
          {inputMode === 'webspeech'
            ? 'ブラウザ音声認識 (Web Speech API)'
            : '録音 + サーバー文字起こし (iOS対応)'}
        </p>
      </section>
    </div>
  )
}
