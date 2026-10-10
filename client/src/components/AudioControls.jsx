import { useEffect, useRef, useState } from 'react'
import { unlockFocusAlertAudio } from '../audio/focusAlertAudio.js'

const AMBIENT_SOUNDS = {
  rain: { label: 'Rain', file: 'rain.wav' },
  cafe: { label: 'Cafe', file: 'cafe.wav' },
  'white-noise': { label: 'White Noise', file: 'white-noise.wav' },
}

function AudioControls({ alertSoundEnabled, onAlertSoundChange }) {
  const audioRef = useRef(null)
  const [sound, setSound] = useState('none')
  const [volume, setVolume] = useState(0.35)
  const [isPlaying, setIsPlaying] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => () => {
    audioRef.current?.pause()
    audioRef.current = null
  }, [])

  function stopAudio() {
    audioRef.current?.pause()
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setIsPlaying(false)
  }

  function selectSound(event) {
    stopAudio()
    setSound(event.target.value)
    setMessage('')
  }

  async function playAudio() {
    if (sound === 'none') {
      setMessage('Choose a study sound first.')
      return
    }

    const file = AMBIENT_SOUNDS[sound].file
    const source = `/audio/${file}`
    setMessage('')

    try {
      const response = await fetch(source, { method: 'HEAD' })
      if (!response.ok) {
        setMessage(`Add ${file} to client/public/audio to use this sound.`)
        return
      }

      if (!audioRef.current || audioRef.current.src !== new URL(source, window.location.href).href) {
        stopAudio()
        audioRef.current = new Audio(source)
        audioRef.current.loop = true
        audioRef.current.volume = volume
      }

      await audioRef.current.play()
      setIsPlaying(true)
    } catch {
      setMessage(`Could not play ${file}. Check that it is a valid audio file.`)
      setIsPlaying(false)
    }
  }

  function pauseAudio() {
    audioRef.current?.pause()
    setIsPlaying(false)
  }

  function changeVolume(event) {
    const nextVolume = Number(event.target.value)
    setVolume(nextVolume)
    if (audioRef.current) audioRef.current.volume = nextVolume
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-white">Study Sounds</h2>
          <p className="mt-1 text-xs text-slate-500">
            Ambient audio is controlled only in this browser.
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={alertSoundEnabled}
            onChange={(event) => {
              if (event.target.checked) unlockFocusAlertAudio()
              onAlertSoundChange(event.target.checked)
            }}
            className="accent-indigo-400"
          />
          Alert Sound: {alertSoundEnabled ? 'ON' : 'OFF'}
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <label htmlFor="ambient-sound" className="sr-only">
          Choose ambient sound
        </label>
        <select
          id="ambient-sound"
          value={sound}
          onChange={selectSound}
          className="min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-400"
        >
          <option value="none">Off</option>
          <option value="rain">Rain</option>
          <option value="cafe">Cafe</option>
          <option value="white-noise">White Noise</option>
        </select>
        <button
          type="button"
          onClick={playAudio}
          disabled={isPlaying}
          className="rounded-xl border border-indigo-300/20 bg-indigo-300/10 px-4 py-3 text-sm font-medium text-indigo-200 disabled:opacity-40"
        >
          Play
        </button>
        <button
          type="button"
          onClick={pauseAudio}
          disabled={!isPlaying}
          className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300 disabled:opacity-40"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => {
            stopAudio()
            setSound('none')
            setMessage('')
          }}
          className="rounded-xl border border-slate-700 px-4 py-3 text-sm font-medium text-slate-300"
        >
          Stop
        </button>
      </div>

      <label
        htmlFor="ambient-volume"
        className="mt-4 flex items-center gap-4 text-sm text-slate-400"
      >
        Volume
        <input
          id="ambient-volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={changeVolume}
          className="w-full accent-indigo-400"
        />
      </label>
      {message && (
        <p className="mt-3 text-xs text-amber-200" role="status">
          {message}
        </p>
      )}
    </section>
  )
}

export default AudioControls
