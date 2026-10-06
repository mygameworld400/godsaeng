import { CATEGORY_ICON } from '../../data/knowledge'
import { CategoryTag, dotDate } from './parts'

/* 상식 한 편 (오늘의 상식·상세 공통): 카테고리 → 제목 → 요약 → 대표 이미지 → 본문 → 알아두기 → 태그 → 저장·노트 */
export default function KnowledgeArticle({ k, date, saved, onSave, onNote, attended, onAttend }) {
  return (
    <article className="kn-article">
      <div className="kn-meta">
        {date && <span className="kn-muted">{dotDate(date)}</span>}
        <CategoryTag c={k.category} />
        <span className="kn-muted">읽는 시간 {k.minutes}분</span>
      </div>
      <h1 className="kn-title">{k.title}</h1>
      <p className="kn-summary">{k.summary}</p>
      <div className="kn-figure">{k.image ? <img src={k.image} alt="" /> : <span>{CATEGORY_ICON[k.category] || '📘'}</span>}</div>
      <div className="kn-body">{k.body.map((p, i) => <p key={i}>{p}</p>)}</div>
      <section className="kn-points">
        <h3 className="kn-h3">알아두기</h3>
        <ul>{k.keyPoints.map((p, i) => <li key={i}>{p}</li>)}</ul>
      </section>
      <div className="kn-tags">{k.tags.map(t => <span key={t}>#{t}</span>)}</div>
      <div className="kn-actions">
        <button className={'btn' + (saved ? ' hl' : '')} onClick={onSave}>{saved ? '★ 저장됨' : '☆ 저장하기'}</button>
        <button className="btn" onClick={onNote}>✎ 내 노트에 정리</button>
        {onAttend && <button className={'btn' + (attended ? ' hl' : ' pri')} onClick={onAttend} disabled={attended}>{attended ? '✓ 오늘 공부 기록됨' : '오늘 공부 완료 기록'}</button>}
      </div>
    </article>
  )
}
