import { useEffect, useState } from 'react'
import { catOf } from '../lib/stats'

export const AVA = ['🐣', '🐻', '🐰', '🦊', '🐱', '🐶', '🐼', '🐸', '🦄', '🐧', '🌱', '🔥']
export const MOODS = ['😆', '🙂', '😐', '😮‍💨', '😭']

export const nickOf = (S, id) => id === S.uid ? S.me?.nick || '나' : S.people[id]?.nick || '아직 가입 전인 친구'
export const avaOf = (S, id) => (id === S.uid ? S.me?.emoji : S.people[id]?.emoji) || '🙂'

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
    <select className="inp" name={name} aria-label="카테고리" defaultValue={value} key={value}>
      <option value="">미분류</option>
      {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

/** 카테고리별로 묶어 그린다. items 에는 _done 이 있어야 한다.
    filter: '' 전체 / 'none' 미분류 / 카테고리 id */
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
  return out.length ? out : <p className="empty">이 카테고리에는 아직 아무것도 없어요.</p>
}

/** 공개/비공개 토글 */
export function PubToggle({ on, onClick }) {
  return <button type="button" className="pubt" aria-pressed={!!on} onClick={onClick}>{on ? '공개' : '비공개'}</button>
}

export function Ring({ pct, label }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div className="ring">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--hl)" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <div className="v">{pct}%<small>{label}</small></div>
    </div>
  )
}
