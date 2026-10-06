/* 종이 넘기는 소리: 소리 파일 없이 Web Audio 로 합성 (잡음 + 대역 필터를 쓸어 '사락' 느낌).
   첫 재생은 사용자 클릭 이후여야 브라우저가 소리를 허용한다 (넘기기는 항상 클릭에서 시작). */
let ctx = null
export function pageSound() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const t0 = ctx.currentTime, len = 0.55
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = buf.getChannelData(0)
    // 바스락거림: 잡음에 작은 '틱'을 섞는다
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.02 ? 1 : 0.45)
    const src = ctx.createBufferSource(); src.buffer = buf
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9
    bp.frequency.setValueAtTime(900, t0); bp.frequency.exponentialRampToValueAtTime(3800, t0 + 0.22); bp.frequency.exponentialRampToValueAtTime(1600, t0 + len)
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05)   // 종이를 집는 순간
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.2)
    g.gain.exponentialRampToValueAtTime(0.42, t0 + 0.32)  // 종이가 넘어가며 스치는 소리
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len)
    src.connect(bp).connect(hp).connect(g).connect(ctx.destination)
    src.start(t0); src.stop(t0 + len)
  } catch { /* 소리 없이 넘김 */ }
}
