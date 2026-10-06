/* 일본어 발음 듣기: 브라우저 내장 음성 읽기(Web Speech API). 음성 파일 없이 동작한다.
   목소리 품질은 브라우저·OS 에 따라 다르다 (Chrome·Edge 는 일본어 목소리가 기본으로 있는 편). */
let voice = null
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices?.() || []
  voice = vs.find(v => /ja[-_]JP/i.test(v.lang) && /Google|Natural|Online/i.test(v.name)) || vs.find(v => /^ja/i.test(v.lang)) || null
}
if (typeof window !== 'undefined' && window.speechSynthesis) {
  pickVoice()
  window.speechSynthesis.onvoiceschanged = pickVoice
}
export const canSpeak = () => typeof window !== 'undefined' && !!window.speechSynthesis

export function speak(text, rate = 0.85) {
  if (!canSpeak() || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'; u.rate = rate
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}
