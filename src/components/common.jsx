import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { catOf } from '../lib/stats'

export const AVA = ['🐣', '🐻', '🐰', '🦊', '🐱', '🐶', '🐼', '🐸', '🦄', '🐧', '🌱', '🔥']
export const MOODS = ['😆', '🙂', '😐', '😮‍💨', '😭']
export const CAT_ICONS = ['🏃', '📚', '🏠', '💪', '🧘', '🍎', '💧', '💰', '🎨', '🎸', '✍️', '💻', '🌱', '🧹', '😴', '🎯', '📖', '🗣️', '✈️', '🏷️']
export const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6']
export const catIcon = c => c?.icon || '🏷️'

/** 팝업. 오른쪽 위 ✕, 바깥 클릭, Esc 로 닫힌다. */
export function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [onClose])
  return createPortal(
    <div className="modal-bg" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <button className="modal-x" aria-label="닫기" onClick={onClose}>✕</button>
        {title && <h2 className="modal-t"><span>{title}</span></h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** 작은 ? 아이콘. 마우스를 올리면(또는 키보드 포커스) 설명이 뜬다. 클릭 동작 없음. */
export function Help({ children }) {
  return (
    <span className="help" tabIndex={0} aria-label={typeof children === 'string' ? children : '도움말'}>
      ?<span className="help-tip" role="tooltip">{children}</span>
    </span>
  )
}

/** 기본 활동에서 온 활동은 원본(base)의 이미지를 쓴다 (이미지는 복사하지 않음). */
export const withImage = (cat, baseCats) => {
  if (!cat || cat.image) return cat
  const b = cat.base ? baseCats.find(x => x.id === cat.base) : null
  if (!b) return cat
  const o = cat.opt && (b.options || []).find(x => x.id === cat.opt)
  // 선택지에 아이콘·이미지가 따로 있으면 그것, 없으면 상위 활동 이미지
  const image = o ? (o.image || (o.icon ? '' : b.image)) : b.image
  return image ? { ...cat, image } : cat
}

/** 이미지(있으면) 또는 이모지 */
export function CatGlyph({ cat, size }) {
  return cat.image
    ? <img className="cglyph-img" src={cat.image} alt="" style={size ? { width: size, height: size } : undefined} />
    : <span className="cglyph-emoji" style={size ? { fontSize: size * 0.8 } : undefined}>{catIcon(cat)}</span>
}

/** 활동 아이콘 + 이름. dim 이면 아직 추가 안 한 기본 활동. */
export function CatIcon({ cat, on, dim, badge, onClick, label }) {
  return (
    <button type="button" className={'cicon' + (on ? ' on' : '') + (dim ? ' dim' : '')} onClick={onClick} aria-pressed={on}>
      <span className="cicon-c"><CatGlyph cat={cat} />{badge && <i className="cicon-b">{badge}</i>}</span>
      <span className="cicon-t">{label ?? cat.name}</span>
    </button>
  )
}

export const nickOf = (S, id) => id === S.uid ? S.me?.nick || '나' : S.people[id]?.nick || '아직 가입 전인 친구'
/** 프로필 사진이 있으면 이미지, 없으면 얼굴 이모지 */
export const avaOf = (S, id) => {
  const p = id === S.uid ? S.me : S.people[id]
  return p?.avatar ? <img className="ava-img" src={p.avatar} alt="" /> : (p?.emoji || '🙂')
}

/** 폼 제출 → 입력값 객체. 빈 값은 trim 된 '' */
export const formVals = e => {
  e.preventDefault()
  return Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v).trim()]))
}

/** 한 번 누르면 '진짜 삭제'로 바뀌고 4초 뒤 원래대로. */
export function ConfirmX({ onConfirm, label = '✕', className = 'x' }) {
  const [ask, setAsk] = useState(false)
  useEffect(() => {
    if (!ask) return
    const t = setTimeout(() => setAsk(false), 4000)
    return () => clearTimeout(t)
  }, [ask])
  return ask
    ? <button type="button" className="btn sm warn" onClick={() => { setAsk(false); onConfirm() }}>진짜 삭제</button>
    : <button type="button" className={className} aria-label="삭제" onClick={() => setAsk(true)}>{label}</button>
}

export function AvaPicker({ value, onChange }) {
  return (
    <div className="emo" role="group" aria-label="얼굴 고르기">
      {AVA.map(e => <button key={e} type="button" className="mood" aria-pressed={value === e} onClick={() => onChange(e)}>{e}</button>)}
    </div>
  )
}

export function CatSelect({ name, cats, value = '' }) {
  return (
    <select className="inp" name={name} aria-label="활동" defaultValue={value} key={value}>
      <option value="">미분류</option>
      {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

/** 활동별로 묶어 그린다. items 에는 _done 이 있어야 한다.
    filter: '' 전체 / 'none' 미분류 / 활동 id */
export function Groups({ profile, items, row, empty, filter = '' }) {
  if (!items.length) return <p className="empty">{empty}</p>
  let cats = [...(profile.cats || []), { id: '', name: '미분류', color: '' }]
  if (filter) cats = cats.filter(c => filter === 'none' ? !c.id : c.id === filter)
  const out = cats.map(c => {
    const list = items.filter(i => c.id ? i.cat === c.id : !catOf(profile, i.cat))
    if (!list.length) return null
    return (
      <div className="grp" key={c.id || '_'}>
        <div className="grp-h">
          <span className="cdot" style={{ background: c.color ? `var(--${c.color})` : 'var(--muted)' }} />
          {c.name}<span className="n">{list.filter(i => i._done).length}/{list.length}</span>
        </div>
        {list.map(row)}
      </div>
    )
  }).filter(Boolean)
  return out.length ? out : <p className="empty">이 활동에는 아직 아무것도 없어요.</p>
}

/** 공개/비공개 토글 */
export function PubToggle({ on, onClick }) {
  return <button type="button" className="pubt" aria-pressed={!!on} onClick={onClick}>{on ? '공개' : '비공개'}</button>
}

export function Ring({ pct, label, size }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className={'ring' + (size ? ' sm' : '')} style={size ? { width: size, height: size } : undefined}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--hl)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="v">{pct}%<small>{label}</small></div>
    </div>
  )
}
