import { useState } from 'react'
import { WD } from '../../lib/date'
import { CATEGORY_ICON } from '../../data/knowledge'

/* 상식 페이지의 작은 조각들: 사이드바, 카드, 출석 달력, 최근 본 상식 */

export const MENU = [['today', '오늘의 상식'], ['browse', '상식 둘러보기'], ['notes', '내 상식 노트'], ['saved', '저장한 상식'], ['attendance', '출석 기록']]
export const dotDate = d => d.slice(0, 10).replace(/-/g, '.')
export const shortDate = iso => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일` }

export function KnowledgeSidebar({ view, go }) {
  return (
    <nav className="kn-side" aria-label="상식 메뉴">
      {MENU.map(([k, l]) => (
        <button key={k} className={'kn-nav' + (view === k || (view === 'detail' && k === 'browse') || (view === 'editor' && k === 'notes') ? ' on' : '')} onClick={() => go(k)}>{l}</button>
      ))}
    </nav>
  )
}

export function CategoryTag({ c }) {
  return <span className="kn-cat">{CATEGORY_ICON[c] || '•'} {c}</span>
}

/** 목록용 작은 카드 */
export function KnowledgeCard({ k, onOpen, extra }) {
  return (
    <button className="kn-card" onClick={() => onOpen(k.id)}>
      <b className="kn-card-t">{k.title}</b>
      <span className="kn-card-m"><CategoryTag c={k.category} /> · 읽는 시간 {k.minutes}분</span>
      {extra}
    </button>
  )
}

/** 출석 달력: 공부한 날만 표시 (보상·연속 기록 없음) */
export function AttendanceCalendar({ attendance, today, big }) {
  const [ym, setYm] = useState(today.slice(0, 7))
  const [y, m] = ym.split('-').map(Number)
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, last = new Date(y, m, 0).getDate()  // 월요일 시작
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  const count = Object.keys(attendance).filter(d => d.startsWith(ym)).length
  const wd = [...WD.slice(1), WD[0]]
  return (
    <div className={'kn-cal' + (big ? ' big' : '')}>
      <div className="kn-cal-h">
        <button className="x" onClick={() => move(-1)} aria-label="지난달">‹</button>
        <b>{y}년 {m}월</b>
        <button className="x" onClick={() => move(1)} aria-label="다음달">›</button>
      </div>
      <div className="kn-cal-g">
        {wd.map(w => <span key={w} className="kn-cal-w">{w}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={'o' + i} />)}
        {Array.from({ length: last }, (_, i) => {
          const ds = ym + '-' + String(i + 1).padStart(2, '0')
          return <span key={ds} className={'kn-cal-d' + (attendance[ds] ? ' on' : '') + (ds === today ? ' today' : '')}>{i + 1}{attendance[ds] && <i>✓</i>}</span>
        })}
      </div>
      <p className="kn-muted">이번 달 공부한 날 <b>{count}일</b></p>
    </div>
  )
}

export function RecentKnowledge({ ids, get, onOpen }) {
  const list = ids.map(get).filter(Boolean).slice(0, 6)
  if (!list.length) return null
  return (
    <section className="kn-block">
      <h3 className="kn-h3">최근 본 상식</h3>
      <div className="kn-recent">{list.map(k => <button key={k.id} className="kn-link" onClick={() => onOpen(k.id)}><CategoryTag c={k.category} /> {k.title}</button>)}</div>
    </section>
  )
}
