import { useEffect, useRef, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD, ymd } from '../lib/date'
import { pageSound } from '../lib/paper'
import { ConfirmX, Modal } from './common'

/* 다이어리 책 (화면 가득, 바깥 상자 없음).
   - 표지(색·무늬·이름표 모양·글자)를 누르면 펼쳐지고 좌우 두 장이 보인다.
   - 넘기기: 왼쪽 장 아래쪽을 누르면 앞으로, 오른쪽 장 아래쪽을 누르면 뒤로. 종이가 실제로 넘어가는 3D 애니메이션 + 종이 소리.
   - 오른쪽 책갈피: 일기 / 메모 / 낙서 구역으로 바로 이동.
   - 일기: 한 장 = 하루. '오늘 장'은 오전 6시 전이면 전날 날짜. 날짜 이동은 일기를 쓴 날만 달력에서 고를 수 있다.
     오늘 탭 '다이어리'에 쓴 글과 같은 저장소(gs_diaries).
   - 메모: 줄 노트에 글. 낙서: 민무늬 종이에 그림. 각자 '새 장'으로 추가 (gs_notes).
   좁은 화면(휴대폰)은 한 장씩. */

const COVER_COLORS = ['#E5534B', '#E08A1E', '#F2C744', '#2E9E6B', '#2F7FD6', '#7A5AE0', '#D14FA0', '#3B3B48', '#C9A27E', '#F4EFE6']
const PATTERNS = [['plain', '민무늬'], ['stripe', '줄무늬'], ['dot', '도트'], ['check', '체크'], ['grid', '모눈']]
const SHAPES = [['square', '네모'], ['circle', '동그라미'], ['heart', '하트']]
const DEFAULT = { color: '#2F7FD6', pattern: 'dot', shape: 'heart', title: 'MY DIARY', sub: '' }
const NARROW = '(max-width: 700px)'
const TURN_MS = 700
const SECTIONS = [['diary', '일기'], ['memo', '메모'], ['doodle', '낙서']]

/** 일기의 '오늘': 오전 6시 전이면 전날 */
export const diaryToday = () => ymd(new Date(Date.now() - 6 * 3600e3))
const pretty = d => `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8))}. (${WD[toD(d).getDay()]})`

function useNarrow() {
  const [n, setN] = useState(() => matchMedia(NARROW).matches)
  useEffect(() => { const m = matchMedia(NARROW), f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

/** 표지 위 스티커들. c.stickers = [{ id, sid, x, y, w }] (x·y 는 표지 안 중심 위치 %, w 는 표지 너비 대비 %) */
function StickerLayer({ c, images, sel, onPick, onDrag }) {
  const ref = useRef(null), drag = useRef(null)
  const down = (e, st) => {
    if (!onDrag) return
    e.stopPropagation(); e.preventDefault(); onPick?.(st.id)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: st.id }
  }
  const move = e => {
    if (!drag.current) return
    const r = ref.current.getBoundingClientRect()
    onDrag(drag.current.id, Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)), false)
  }
  const up = () => { if (drag.current) { onDrag(drag.current.id, null, null, true); drag.current = null } }
  return (
    <span className="stickers" ref={ref} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      {(c.stickers || []).map(st => images[st.sid] && (
        <img key={st.id} src={images[st.sid]} alt="" draggable={false} className={'stk' + (sel === st.id ? ' sel' : '')}
          style={{ left: st.x + "%", top: st.y + "%", width: st.w + "%" }} onPointerDown={e => down(e, st)} onClick={e => onDrag && e.stopPropagation()} />
      ))}
    </span>
  )
}

/** 작은 표지 (친구 미니홈피 등에서 표지만 보여 줄 때) */
export function CoverMini({ cover, onClick, title }) {
  const { S } = useStore()
  const c = { ...DEFAULT, ...cover }
  const images = Object.fromEntries((S.site?.stickers || []).map(x => [x.id, x.image]))
  return (
    <button type="button" className={'cover mini pat-' + c.pattern} style={{ '--cover': c.color }} onClick={onClick} title={title} disabled={!onClick}>
      <span className="cover-spine" />
      <Label c={c} />
      <StickerLayer c={c} images={images} />
    </button>
  )
}

function Label({ c }) {
  return (
    <div className={'cover-label shape-' + c.shape}>
      {c.shape === 'heart' && (
        <svg viewBox="0 0 100 90" aria-hidden="true"><path d="M50 86 C20 62 2 46 2 26 C2 12 13 2 27 2 C37 2 45 8 50 16 C55 8 63 2 73 2 C87 2 98 12 98 26 C98 46 80 62 50 86 Z" /></svg>
      )}
      <span className="cover-title">{c.title || ' '}</span>
      {c.sub && <span className="cover-sub">{c.sub}</span>}
    </div>
  )
}

/** 낙서 장: 민무늬 종이에 펜으로 그린다. 손을 뗄 때마다 그림을 저장. */
function Doodle({ value, onSave }) {
  const ref = useRef(null), drawing = useRef(false), wrap = useRef(null)
  useEffect(() => {
    const c = ref.current, dpr = window.devicePixelRatio || 1, r = wrap.current.getBoundingClientRect()
    c.width = r.width * dpr; c.height = r.height * dpr
    const ctx = c.getContext('2d')
    ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1B2440'
    if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height); img.src = value }
    // 처음 한 번만 그린다 (그 뒤엔 캔버스가 원본)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pos = e => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const down = e => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)) }
  const move = e => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke() }
  const up = () => { if (!drawing.current) return; drawing.current = false; onSave(ref.current.toDataURL('image/png')) }
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); onSave('') }
  return (
    <div className="doodle" ref={wrap}>
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="낙서" />
      <ConfirmX onConfirm={clear} label="다 지우기" className="x doodle-clear" />
    </div>
  )
}

/** 일기를 쓴 날만 진하게, 누를 수 있는 달력 */
function DateJump({ written, current, onPick, onClose }) {
  const [ym, setYm] = useState(current.slice(0, 7))
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate()
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  return (
    <div className="jump" onClick={e => e.stopPropagation()}>
      <div className="row between"><button className="btn sm" onClick={() => move(-1)}>‹</button><b>{y}년 {m}월</b><button className="btn sm" onClick={() => move(1)}>›</button></div>
      <div className="jump-grid">
        {[...WD].map(w => <span key={w} className="sub">{w}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={'o' + i} />)}
        {Array.from({ length: last }, (_, i) => {
          const ds = ym + '-' + String(i + 1).padStart(2, '0'), ok = written.has(ds)
          return <button key={ds} className={'jd' + (ok ? ' on' : '') + (ds === current ? ' cur' : '')} disabled={!ok} onClick={() => onPick(ds)}>{i + 1}</button>
        })}
      </div>
      <button className="btn sm" onClick={onClose}>닫기</button>
    </div>
  )
}

export default function DiaryBook({ onClose }) {
  const { S, act } = useStore()
  const narrow = useNarrow(), per = narrow ? 1 : 2
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)            // 펼친 첫 장 번호 (두 장이면 짝수)
  const [turn, setTurn] = useState(null)     // { dir: 'next'|'prev', to }
  const [deco, setDeco] = useState(false)
  const [sel, setSel] = useState(null)        // 표지에서 고른 스티커
  const [dragPos, setDragPos] = useState(null) // 끄는 중인 스티커 위치 (놓을 때 저장)
  const [jump, setJump] = useState(false)
  useEffect(() => { act.loadAllDiaries(); act.loadNotes() }, [act])

  const c = { ...DEFAULT, ...S.diaryCover }
  const stickerImgs = Object.fromEntries((S.site?.stickers || []).map(x => [x.id, x.image]))
  const liveCover = dragPos ? { ...c, stickers: (c.stickers || []).map(x => x.id === dragPos.id ? { ...x, x: dragPos.x, y: dragPos.y } : x) } : c
  const selSticker = (c.stickers || []).find(x => x.id === sel)
  const dragSticker = (id, x, y, done) => {
    if (!done) { setDragPos({ id, x, y }); return }
    if (dragPos?.id === id) act.setDiaryCover({ stickers: (c.stickers || []).map(s => s.id === id ? { ...s, x: dragPos.x, y: dragPos.y } : s) })
    setDragPos(null)
  }
  const resize = d => act.setDiaryCover({ stickers: (c.stickers || []).map(x => x.id === sel ? { ...x, w: Math.max(6, Math.min(70, x.w + d)) } : x) })
  const dToday = diaryToday()

  /* ---------- 장 목록: 일기 → 메모 → 낙서. 구역은 새 펼침(짝수 장)에서 시작 ---------- */
  const written = new Set(Object.keys(S.diary).filter(d => (S.diary[d] || '').trim()))
  const diaryDates = [...new Set([...written, dToday])].filter(d => d <= dToday).sort()
  const pages = [], start = {}
  const pad = () => { if (per === 2 && pages.length % 2) pages.push({ kind: 'blank', key: 'pad' + pages.length }) }
  start.diary = 0
  diaryDates.forEach(d => pages.push({ kind: 'diary', key: 'd' + d, date: d }))
  pad(); start.memo = pages.length
  ;(S.notes || []).filter(n => n.kind === 'memo').forEach(n => pages.push({ kind: 'memo', key: n.id, note: n }))
  pages.push({ kind: 'add', key: 'add-memo', add: 'memo' })
  pad(); start.doodle = pages.length
  ;(S.notes || []).filter(n => n.kind === 'doodle').forEach(n => pages.push({ kind: 'doodle', key: n.id, note: n }))
  pages.push({ kind: 'add', key: 'add-doodle', add: 'doodle' })
  const sectionOf = i => i >= start.doodle ? 'doodle' : i >= start.memo ? 'memo' : 'diary'
  const align = i => i - (i % per)

  /* ---------- 넘기기 ---------- */
  const goTo = to => {
    to = Math.max(0, Math.min(align(to), align(pages.length - 1)))
    if (turn || to === at) return
    pageSound()
    setTurn({ dir: to > at ? 'next' : 'prev', to })
    setTimeout(() => { setAt(to); setTurn(null) }, TURN_MS)
  }
  const next = () => goTo(at + per)
  const prev = () => { if (at === 0) { pageSound(); setOpen(false) } else goTo(at - per) }

  /* ---------- 장 그리기 (렌더 함수: 컴포넌트로 만들면 글 쓰는 중 커서가 풀린다) ---------- */
  const leafBody = (p, live) => {
    if (!p || p.kind === 'blank') return null
    if (p.kind === 'diary') return <>
      <div className="paper-head">
        <b>{pretty(p.date)}</b>
        {S.days[p.date]?.mood && <span className="paper-mood">{S.days[p.date].mood}</span>}
        {p.date === dToday && <span className="pill">오늘</span>}
        {live && <button className="btn sm jump-btn" onClick={() => setJump(!jump)}>📅 날짜 이동</button>}
      </div>
      {live
        ? <textarea className="paper-text" value={S.diary[p.date] || ''} placeholder={p.date === dToday ? '오늘 하루는 어땠나요?' : ''}
            onChange={e => act.setDiaryAt(p.date, e.target.value)} aria-label={pretty(p.date) + ' 일기'} />
        : <p className="paper-text ro">{S.diary[p.date] || ''}</p>}
    </>
    if (p.kind === 'memo') return <>
      <div className="paper-head"><b>메모</b>{live && <ConfirmX onConfirm={() => act.delNote(p.note.id)} label="이 장 찢기" className="x" />}</div>
      {live
        ? <textarea className="paper-text" value={p.note.body} placeholder="자유롭게 적어요." onChange={e => act.saveNote(p.note.id, e.target.value)} aria-label="메모" />
        : <p className="paper-text ro">{p.note.body}</p>}
    </>
    if (p.kind === 'doodle') return <>
      <div className="paper-head"><b>낙서</b>{live && <ConfirmX onConfirm={() => act.delNote(p.note.id)} label="이 장 찢기" className="x" />}</div>
      {live ? <Doodle key={p.note.id} value={p.note.body} onSave={v => act.saveNote(p.note.id, v)} />
        : p.note.body ? <img className="doodle-img" src={p.note.body} alt="" /> : <div className="doodle" />}
    </>
    // add
    return <div className="add-page">
      {S.notesError ? <p className="sub">메모·낙서 저장 준비 중이에요.</p> : live
        ? <button className="btn pri" onClick={() => act.addNote(p.add)}>+ 새 {p.add === 'memo' ? '메모' : '낙서'} 장</button>
        : <span className="sub">+ 새 장</span>}
    </div>
  }
  // 낙서·빈 장은 민무늬, 일기·메모는 줄 노트
  const leafClass = p => 'leaf' + (!p || p.kind === 'doodle' || p.kind === 'blank' || (p.kind === 'add' && p.add === 'doodle') ? ' plain' : '')
  const leaf = (p, side, live = true) => (
    <div key={side} className={leafClass(p) + ' ' + side}>
      {leafBody(p, live)}
      {p && p.kind !== 'blank' && p.kind !== 'add' && <span className="paper-no">{pages.indexOf(p) + 1}</span>}
      {live && <button className={'corner ' + side} onClick={side === 'left' ? prev : next} aria-label={side === 'left' ? '앞장으로' : '뒷장으로'}>
        <span>{side === 'left' ? '‹' : '›'}</span>
      </button>}
    </div>
  )

  // 넘기는 중: 아래에 깔린 장 + 넘어가는 종이(앞면/뒷면)
  let left, right, turner = null
  if (!turn || per === 1) {
    left = per === 2 ? leaf(pages[at], 'left') : null
    right = leaf(pages[per === 2 ? at + 1 : at], 'right')
  } else if (turn.dir === 'next') {
    left = leaf(pages[at], 'left', false)
    right = leaf(pages[turn.to + 1], 'right', false)
    turner = <div className="turner next"><div className="face front">{leaf(pages[at + 1], 'right', false)}</div><div className="face back">{leaf(pages[turn.to], 'left', false)}</div></div>
  } else {
    left = leaf(pages[turn.to], 'left', false)
    right = leaf(pages[at + 1], 'right', false)
    turner = <div className="turner prev"><div className="face front">{leaf(pages[at], 'left', false)}</div><div className="face back">{leaf(pages[turn.to + 1], 'right', false)}</div></div>
  }
  const curSection = sectionOf(at)

  return (
    <Modal bare title="다이어리" onClose={onClose}>
      <div className="diary-stage">
        {!open ? (
          <div className={'cover-wrap' + (deco ? ' deco-open' : '')}>
            <div className="cover-col">
              <button className={'cover pat-' + c.pattern} style={{ '--cover': c.color }} aria-label={deco ? '다이어리 표지' : '다이어리 펼치기'}
                onClick={() => { if (deco) { setSel(null); return } pageSound(); setOpen(true); setAt(align(Math.max(0, diaryDates.indexOf(dToday)))) }}>
                <span className="cover-spine" />
                <Label c={c} />
                <StickerLayer c={liveCover} images={stickerImgs} sel={deco ? sel : null} onPick={setSel} onDrag={deco ? dragSticker : null} />
                {!deco && <span className="cover-hint">눌러서 펼치기 ›</span>}
              </button>
              <button className={'btn sm' + (deco ? ' hl' : '')} onClick={() => { setDeco(!deco); setSel(null) }}>{deco ? '꾸미기 끝' : '🎨 표지 꾸미기'}</button>
            </div>
            <div className="deco-side" aria-hidden={!deco}>
              {deco && <div className="deco">
                <div className="row" role="radiogroup" aria-label="표지 색">
                  {COVER_COLORS.map(col => <button key={col} className={'swatch big' + (c.color === col ? ' on' : '')} style={{ background: col }} aria-label={col} onClick={() => act.setDiaryCover({ color: col })} />)}
                  <input type="color" value={c.color} onChange={e => act.setDiaryCover({ color: e.target.value })} aria-label="다른 색" />
                </div>
                <div className="row"><span className="sub">무늬</span>{PATTERNS.map(([k, l]) => <button key={k} className={'btn sm' + (c.pattern === k ? ' hl' : '')} onClick={() => act.setDiaryCover({ pattern: k })}>{l}</button>)}</div>
                <div className="row"><span className="sub">이름표</span>{SHAPES.map(([k, l]) => <button key={k} className={'btn sm' + (c.shape === k ? ' hl' : '')} onClick={() => act.setDiaryCover({ shape: k })}>{l}</button>)}</div>
                <input className="inp" value={c.title} maxLength={20} onChange={e => act.setDiaryCover({ title: e.target.value })} placeholder="표지 제목" aria-label="표지 제목" />
                <input className="inp" value={c.sub} maxLength={30} onChange={e => act.setDiaryCover({ sub: e.target.value })} placeholder="작은 글씨 (예: 2026 갓생 기록)" aria-label="작은 글씨" />

                <div className="sticker-corner">
                  <b className="sub">스티커</b>
                  {selSticker && (
                    <div className="row">
                      <span className="sub">고른 스티커</span>
                      <button className="btn sm" onClick={() => resize(-4)}>작게</button>
                      <button className="btn sm" onClick={() => resize(4)}>크게</button>
                      <button className="btn sm warn" onClick={() => { act.setDiaryCover({ stickers: (c.stickers || []).filter(x => x.id !== sel) }); setSel(null) }}>떼기</button>
                    </div>
                  )}
                  {(S.site?.stickers || []).length ? (
                    <div className="sticker-tray">{S.site.stickers.map(st => (
                      <button key={st.id} className="sticker-pick on" title="표지에 붙이기" onClick={() => {
                        const n = { id: Math.random().toString(36).slice(2, 9), sid: st.id, x: 50 + (Math.random() * 20 - 10), y: 70 + (Math.random() * 10 - 5), w: 22 }
                        act.setDiaryCover({ stickers: [...(c.stickers || []), n] }); setSel(n.id)
                      }}><img src={st.image} alt="" /></button>
                    ))}</div>
                  ) : <p className="sub">아직 스티커가 없어요. 관리자가 추가하면 여기에 보여요.</p>}
                  <p className="sub">스티커를 누르면 표지에 붙어요. 표지 위에서 끌어 옮기고, 고른 뒤 크기를 바꾸거나 뗄 수 있어요.</p>
                </div>
              </div>}
            </div>
          </div>
        ) : (
          <div className={'spread' + (narrow ? ' one' : '') + (narrow && turn ? ' flip-' + turn.dir : '')} style={{ '--cover': c.color }}>
            {left}{right}{turner}
            <div className="marks" role="tablist" aria-label="책갈피">
              {SECTIONS.map(([k, l]) => (
                <button key={k} role="tab" aria-selected={curSection === k} className={'mark mark-' + k + (curSection === k ? ' on' : '')} onClick={() => goTo(start[k])}>{l}</button>
              ))}
            </div>
            {jump && <DateJump written={written} current={pages[at]?.date || dToday} onClose={() => setJump(false)}
              onPick={d => { setJump(false); goTo(diaryDates.indexOf(d)) }} />}
          </div>
        )}
      </div>
    </Modal>
  )
}
