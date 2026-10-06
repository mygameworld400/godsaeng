/* 띠링띠링: Web Audio 로 두 음을 두 번. 첫 재생은 사용자 클릭(시작 버튼) 이후여야 브라우저가 소리를 허용한다. */
let ctx = null
export function unlockAudio() {
  try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume() } catch { /* 소리 없이 진행 */ }
}
export function chime() {
  unlockAudio()
  if (!ctx) return
  const t0 = ctx.currentTime
  ;[0, 0.22, 0.6, 0.82].forEach((dt, i) => {
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.value = i % 2 ? 1318.5 : 1046.5  // C6 → E6
    g.gain.setValueAtTime(0.0001, t0 + dt)
    g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.35)
    o.connect(g).connect(ctx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.4)
  })
}
