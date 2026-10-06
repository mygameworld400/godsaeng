import { useEffect, useRef, useState } from 'react'
import { CategoryTag, dotDate, shortDate } from './parts'

/* 지식 한 편 (오늘의 지식·상세 공통): 카테고리 → 제목 → 요약 → 대표 이미지 → 본문 → 알아두기 → 태그 → 저장·노트
   본문에서 글자를 드래그하면 누구나 형광펜 설명을 달 수 있다. 칠한 곳에 마우스를 올리면 설명이 옆에 뜬다. */

export const MARK_COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange']

/** 문단 안의 설명 위치 찾기: 글이 고쳐져 자리가 바뀌었으면 quote 로 다시 찾고, 못 찾으면 뺀다. 겹치면 먼저 단 것만 */
function placeMarks(text, marks) {
  const out = []
  for (const m of marks) {
    let s = text.substr(m.start, m.len) === m.quote ? m.start : text.indexOf(m.quote)
    if (s < 0) continue
    const e = s + m.quote.length
    if (out.some(o => s < o.e && e > o.s)) continue
    out.push({ m, s, e })
  }
  return out.sort((a, b) => a.s - b.s)
}

function Para({ i, text, marks, onEnter, onLeave }) {
  const placed = placeMarks(text, marks)
  const parts = []
  let at = 0
  for (const { m, s, e } of placed) {
    if (s > at) parts.push(text.slice(at, s))
    parts.push(<mark key={m.id} className={'kn-hl c-' + m.color} onMouseEnter={ev => onEnter(m, ev.currentTarget)} onMouseLeave={onLeave}>{text.slice(s, e)}</mark>)
    at = e
  }
  if (at < text.length) parts.push(text.slice(at))
  return <p data-para={i}>{parts}</p>
}

export default function KnowledgeArticle({ k, image, date, saved, onSave, onNote, attended, onAttend, marks = [], onAddMark, onDeleteMark, canDelete, nick }) {
  const art = useRef(null), bodyRef = useRef(null), closeT = useRef(0)
  const [sel, setSel] = useState(null)       // { para, start, len, quote, x, y }
  const [form, setForm] = useState(null)     // { color, note }
  const [hover, setHover] = useState(null)   // { m, x, y }
  const [msg, setMsg] = useState('')
  useEffect(() => { setSel(null); setForm(null); setHover(null) }, [k.id])
  useEffect(() => {  // 스크롤하면 떠 있는 버튼·설명은 닫는다 (위치가 어긋나므로)
    const sc = art.current?.closest('.kn-main')
    const f = () => { setHover(null); setSel(s => (form ? s : null)) }
    sc?.addEventListener('scroll', f, { passive: true })
    return () => sc?.removeEventListener('scroll', f)
  }, [form])
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(''), 2500); return () => clearTimeout(t) }, [msg])

  // 드래그가 끝나면 한 문단 안의 선택인지 보고 '설명 달기' 버튼을 띄운다
  const onMouseUp = () => {
    if (!onAddMark || form) return
    const s = window.getSelection()
    if (!s || s.isCollapsed || !s.rangeCount) return setSel(null)
    const r = s.getRangeAt(0)
    const el = n => (n.nodeType === 1 ? n : n.parentElement)
    const pa = el(r.startContainer)?.closest('[data-para]'), pb = el(r.endContainer)?.closest('[data-para]')
    if (!pa || pa !== pb || !bodyRef.current?.contains(pa)) { setSel(null); if (pa || pb) setMsg('한 문단 안에서만 설명을 달 수 있어요.'); return }
    const quote = r.toString()
    if (!quote.trim()) return setSel(null)
    if (quote.length > 500) { setSel(null); return setMsg('500자까지만 칠할 수 있어요.') }
    const pre = document.createRange(); pre.selectNodeContents(pa); pre.setEnd(r.startContainer, r.startOffset)
    const para = +pa.dataset.para, start = pre.toString().length
    const text = k.body[para]
    if (placeMarks(text, marks.filter(m => m.para === para)).some(o => start < o.e && start + quote.length > o.s)) { setSel(null); return setMsg('이미 설명이 달린 부분과 겹쳐요.') }
    const rect = r.getBoundingClientRect()
    setSel({ para, start, len: quote.length, quote, x: rect.left + rect.width / 2, y: rect.bottom + 8 })
  }

  const enter = (m, el) => {
    clearTimeout(closeT.current)
    const rc = el.getBoundingClientRect(), ar = art.current.getBoundingClientRect()
    const room = innerWidth - ar.right > 300
    setHover({ m, x: room ? ar.right + 20 : Math.min(rc.left, innerWidth - 300), y: room ? rc.top - 4 : rc.bottom + 8 })
  }
  const leave = () => { closeT.current = setTimeout(() => setHover(null), 250) }
  const save = async () => {
    if (!form.note.trim()) return
    try { await onAddMark({ ...sel, color: form.color, note: form.note.trim() }); setSel(null); setForm(null); window.getSelection()?.removeAllRanges() }
    catch { setMsg('저장하지 못했어요. 잠시 뒤에 다시 해 주세요.') }
  }
  const clamp = (x, w) => Math.max(12, Math.min(x - w / 2, innerWidth - w - 12))

  return (
    <article className="kn-article" ref={art}>
      <div className="kn-meta">
        {date && <span className="kn-muted">{dotDate(date)}</span>}
        <CategoryTag c={k.category} />
        <span className="kn-muted">읽는 시간 {k.minutes}분</span>
      </div>
      <h1 className="kn-title">{k.title}</h1>
      {k.summary && <p className="kn-summary">{k.summary}</p>}
      {image === undefined ? null : image ? <div className="kn-figure"><img src={image} alt="" /></div> : null}
      <div className="kn-body" ref={bodyRef} onMouseUp={onMouseUp}>
        {k.body.map((p, i) => <Para key={i} i={i} text={p} marks={marks.filter(m => m.para === i)} onEnter={enter} onLeave={leave} />)}
      </div>
      {onAddMark && <p className="kn-muted kn-hint">본문 글자를 드래그하면 형광펜으로 설명을 달 수 있어요. 모두에게 보여요.</p>}
      {k.keyPoints.length > 0 && (
        <section className="kn-points">
          <h3 className="kn-h3">알아두기</h3>
          <ul>{k.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </section>
      )}
      {k.tags.length > 0 && <div className="kn-tags">{k.tags.map(t => <span key={t}>#{t}</span>)}</div>}
      <div className="kn-actions">
        <button className={'btn' + (saved ? ' hl' : '')} onClick={onSave}>{saved ? '★ 저장됨' : '☆ 저장하기'}</button>
        <button className="btn" onClick={onNote}>✎ 내 노트에 정리</button>
        {onAttend && <button className={'btn' + (attended ? ' hl' : ' pri')} onClick={onAttend} disabled={attended}>{attended ? '✓ 오늘 공부 기록됨' : '오늘 공부 완료 기록'}</button>}
      </div>

      {sel && !form && (
        <button className="kn-pop kn-addmark" style={{ left: clamp(sel.x, 120), top: sel.y }} onMouseDown={e => e.preventDefault()} onClick={() => setForm({ color: 'yellow', note: '' })}>🖍 설명 달기</button>
      )}
      {sel && form && (
        <div className="kn-pop kn-markform" style={{ left: clamp(sel.x, 300), top: sel.y }}>
          <p className="kn-quote"><mark className={'kn-hl c-' + form.color}>{sel.quote.length > 60 ? sel.quote.slice(0, 60) + '…' : sel.quote}</mark></p>
          <div className="kn-colors" role="radiogroup" aria-label="형광펜 색">
            {MARK_COLORS.map(c => <button key={c} role="radio" aria-checked={form.color === c} aria-label={c} className={'kn-color c-' + c + (form.color === c ? ' on' : '')} onClick={() => setForm({ ...form, color: c })} />)}
          </div>
          <textarea className="inp" rows={3} autoFocus value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="이 부분에 대한 설명을 적어 주세요" maxLength={1000} />
          <div className="kn-row"><span /><span className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => { setForm(null); setSel(null) }}>취소</button>
            <button className="btn sm pri" onClick={save} disabled={!form.note.trim()}>달기</button>
          </span></div>
        </div>
      )}
      {hover && (
        <div className={'kn-pop kn-markcard c-' + hover.m.color} style={{ left: hover.x, top: hover.y }} onMouseEnter={() => clearTimeout(closeT.current)} onMouseLeave={leave}>
          <p>{hover.m.note}</p>
          <div className="kn-row">
            <small className="kn-muted">{nick(hover.m.userId)} · {shortDate(hover.m.createdAt)}</small>
            {canDelete(hover.m) && <button className="x" onClick={() => { onDeleteMark(hover.m); setHover(null) }}>지우기</button>}
          </div>
        </div>
      )}
      {msg && <div className="kn-toast" role="status">{msg}</div>}
    </article>
  )
}
