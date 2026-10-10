let audioContext

export async function unlockFocusAlertAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return

  try {
    audioContext ||= new AudioContextClass()
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }
  } catch {
    audioContext = undefined
  }
}

export function playFocusAlertSound() {
  if (!audioContext || audioContext.state !== 'running') return

  try {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(660, now)
    oscillator.frequency.setValueAtTime(520, now + 0.12)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.36)
  } catch {
    // Keep the visual alert available if audio is unavailable.
  }
}
