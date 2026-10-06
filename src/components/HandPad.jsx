import { useEffect, useRef } from 'react'

/* 손글씨 칸: 마우스·펜·손가락으로 쓴다. 채점·인식은 하지 않고, 저장도 하지 않는다 (연습용). */
export default function HandPad({ height = 140 }) {
  const ref = useRef(null), drawing = useRef(false)
  useEffect(() => {
    const c = ref.current, dpr = window.devicePixelRatio || 1
    const fit = () => {
      const w = c.clientWidth
      c.width = w * dpr; c.height = height * dpr
      const ctx = c.getContext('2d')
      ctx.scale(dpr, dpr); ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = getComputedStyle(c).color
    }
    fit()
  }, [height])
  const pos = e => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = e => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)) }
  const move = e => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke() }
  const up = () => { drawing.current = false }
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height) }
  return (
    <div className="handpad">
      <canvas ref={ref} style={{ height }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="손글씨 칸" />
      <button type="button" className="x" onClick={clear}>지우기</button>
    </div>
  )
}
