import { useState } from 'react'
import { CATEGORIES } from '../../data/knowledge'
import { KnowledgeCard } from './parts'

/** 검색어·카테고리로 거르기 (제목·요약·본문·태그) */
export function matchKnowledge(k, q, cat) {
  if (cat && k.category !== cat) return false
  if (!q) return true
  const t = q.trim().toLowerCase()
  return [k.title, k.summary, ...k.body, ...k.tags].some(s => s.toLowerCase().includes(t))
}

export function CategoryFilter({ cat, setCat }) {
  return (
    <div className="kn-filters" role="tablist" aria-label="카테고리">
      {['', ...CATEGORIES].map(c => <button key={c || 'all'} role="tab" aria-selected={cat === c} className={'kn-chip' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>{c || '전체'}</button>)}
    </div>
  )
}

/** 상식 둘러보기: 카테고리 + 검색 + 라이브러리형 목록 */
export default function KnowledgeBrowser({ items, onOpen, children }) {
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const list = items.filter(k => matchKnowledge(k, q, cat))
  return (
    <div className="kn-page">
      <h2 className="kn-h2">상식 둘러보기</h2>
      <CategoryFilter cat={cat} setCat={setCat} />
      <input className="inp kn-search" value={q} onChange={e => setQ(e.target.value)} placeholder="궁금한 상식을 검색하세요" aria-label="상식 검색" />
      <p className="kn-muted">{list.length}개</p>
      <div className="kn-grid">{list.map(k => <KnowledgeCard key={k.id} k={k} onOpen={onOpen} />)}</div>
      {!list.length && <p className="kn-empty">찾는 상식이 없어요. 다른 검색어로 찾아보세요.</p>}
      {children}
    </div>
  )
}
