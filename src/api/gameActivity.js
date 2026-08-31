export function reportSpeechActivity(speaking) {
  if (typeof window !== 'undefined' && window.dispatchEvent) window.dispatchEvent(new CustomEvent('game-speech-activity', { detail: { speaking } }))
}
