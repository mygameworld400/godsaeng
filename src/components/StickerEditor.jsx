import { useEffect, useRef, useState } from 'react'
import { Modal } from './common'

/* 스티커 한 장 손질: 붓으로 칠해서 '되살리기'(원본 그림을 다시 보이게) 또는 '지우기'.
   누끼가 몸통까지 먹은 곳은 되살리고, 덜 지워진 배경은 지운다. 확대해서 보여 준다. */

const load = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })

export default function StickerEditor({ cut, orig, onSave, onClose }) {
  const ref = useRef(null), origImg = useRef(null), drawing = useRef(false)
  const [mode, setMode] = useState('restore')
  const [size, setSize] = useState(10)
  const [zoom, setZoom] = useState(3)
  const [w, setW] = useState(0)  // 스티커 실제 너비
  useEffect(() => {
    Promise.all([load(cut), load(orig)]).then(([a, b]) => {
      const c = ref.current; c.width = a.width; c.height = a.height
      c.getContext('2d').drawImage(a, 0, 0); origImg.current = b; setW(a.width)
      setZoom(Math.max(1, Math.min(4, Math.floor(420 / Math.max(a.width, a.height)))))
    })
  }, [cut, orig])
  const paint = e => {
    const c = ref.current, r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * c.width, y = (e.clientY - r.top) / r.height * c.height
    const g = c.getContext('2d'), rad = size / 2
    g.save(); g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2)
    if (mode === 'erase') { g.globalCompositeOperation = 'destination-out'; g.fill() }
    else { g.clip(); g.clearRect(x - rad, y - rad, size, size); g.drawImage(origImg.current, 0, 0) }
    g.restore()
  }
  const down = e => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; paint(e) }
  const move = e => { if (drawing.current) paint(e) }
  const up = () => { drawing.current = false }
  return (
    <Modal title="스티커 손질" onClose={onClose}>
      <div className="row">
        <button className={'btn sm' + (mode === 'restore' ? ' hl' : '')} onClick={() => setMode('restore')}>🖌 되살리기</button>
        <button className={'btn sm' + (mode === 'erase' ? ' hl' : '')} onClick={() => setMode('erase')}>🧽 지우기</button>
        <label className="toggle">붓 크기 <input type="range" min={2} max={40} value={size} onChange={e => setSize(+e.target.value)} /> {size}</label>
      </div>
      <p className="sub">되살리기: 누끼에 먹힌 부분을 칠하면 원래 그림이 돌아와요. 지우기: 남은 배경을 칠해서 지워요.</p>
      <div className="editor-stage">
        <canvas ref={ref} style={{ width: w ? w * zoom : undefined }} className="editor-canvas"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      </div>
      <div className="row">
        <button className="btn pri" onClick={() => onSave(ref.current.toDataURL('image/png'))}>저장</button>
        <button className="btn" onClick={onClose}>취소</button>
      </div>
    </Modal>
  )
}
