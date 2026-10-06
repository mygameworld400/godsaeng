import { useState } from 'react'
import { shortDate } from './parts'

/* 내 지식 노트: 목록(검색·태그 필터) + 작성/수정 화면 */

export function KnowledgeNoteList({ notes, onNew, onOpen }) {
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const tags = [...new Set(notes.flatMap(n => n.tags))]
  const list = notes.filter(n => (!tag || n.tags.includes(tag)) && (!q || (n.title + n.body).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return (
    <div className="kn-page">
      <div className="kn-row">
        <h2 className="kn-h2">내 지식 노트</h2>
        <button className="btn pri" onClick={onNew}>+ 새 노트</button>
      </div>
      <input className="inp kn-search" value={q} onChange={e => setQ(e.target.value)} placeholder="노트 검색" aria-label="노트 검색" />
      {tags.length > 0 && <div className="kn-filters">
        <button className={'kn-chip' + (!tag ? ' on' : '')} onClick={() => setTag('')}>전체</button>
        {tags.map(t => <button key={t} className={'kn-chip' + (tag === t ? ' on' : '')} onClick={() => setTag(t)}>#{t}</button>)}
      </div>}
      <div className="kn-grid notes">{list.map(n => (
        <button key={n.id} className="kn-card note" onClick={() => onOpen(n.id)}>
          <b className="kn-card-t">{n.title || '제목 없음'}</b>
          <span className="kn-note-ex">{n.body.slice(0, 80)}</span>
          {n.tags.length > 0 && <span className="kn-tags small">{n.tags.map(t => <span key={t}>#{t}</span>)}</span>}
          <span className="kn-muted">{shortDate(n.updatedAt)} 수정</span>
        </button>
      ))}</div>
      {!list.length && <p className="kn-empty">{notes.length ? '조건에 맞는 노트가 없어요.' : '아직 노트가 없어요. 지식을 읽고 "내 노트에 정리"를 눌러 보세요.'}</p>}
    </div>
  )
}

export function KnowledgeNoteEditor({ note, related, onSave, onDelete, onCancel, onOpenRelated }) {
  const [title, setTitle] = useState(note.title || '')
  const [body, setBody] = useState(note.body || '')
  const [tags, setTags] = useState(note.tags || [])
  const [tagIn, setTagIn] = useState('')
  const addTag = () => { const t = tagIn.trim().replace(/^#/, ''); if (t && !tags.includes(t)) setTags([...tags, t]); setTagIn('') }
  return (
    <div className="kn-page kn-editor">
      <h2 className="kn-h2">{note.updatedAt ? '노트 수정' : '새 노트'}</h2>
      <label className="kn-label">제목<input className="inp" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 남극과 사막에 대해" maxLength={80} /></label>
      {related && (
        <div className="kn-related"><span className="kn-muted">관련 지식</span>
          <button className="kn-link" onClick={() => onOpenRelated(related.id)}>📎 {related.title}</button>
        </div>
      )}
      <label className="kn-label">내용<textarea className="inp kn-textarea" value={body} onChange={e => setBody(e.target.value)} placeholder="자유롭게 정리해 보세요." rows={14} /></label>
      <div className="kn-label">태그
        <div className="kn-tag-edit">
          {tags.map(t => <span key={t} className="kn-chip on">#{t}<button className="x" onClick={() => setTags(tags.filter(x => x !== t))} aria-label={t + ' 빼기'}>✕</button></span>)}
          <input className="inp" value={tagIn} onChange={e => setTagIn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="태그 입력 후 Enter" style={{ width: 160 }} />
          <button className="btn sm" onClick={addTag}>+ 추가</button>
        </div>
      </div>
      <div className="kn-actions">
        <button className="btn pri" onClick={() => onSave({ ...note, title: title.trim(), body, tags })} disabled={!title.trim() && !body.trim()}>저장</button>
        <button className="btn" onClick={onCancel}>취소</button>
        {note.updatedAt && <button className="btn warn" onClick={onDelete}>삭제</button>}
      </div>
    </div>
  )
}
