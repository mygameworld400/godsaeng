import { useEffect, useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { today } from '../../lib/date'
import { getKnowledge, listKnowledge, todayKnowledge } from '../../lib/knowledgeData'
import { useKnowledgeStore } from '../../lib/knowledgeStore'
import KnowledgeArticle from './KnowledgeArticle'
import KnowledgeBrowser, { CategoryFilter, matchKnowledge } from './KnowledgeBrowser'
import { KnowledgeNoteEditor, KnowledgeNoteList } from './KnowledgeNotes'
import { AttendanceCalendar, KnowledgeCard, KnowledgeSidebar, RecentKnowledge, dotDate, shortDate } from './parts'

/* 상식 페이지 (추천 활동 page_kind = 'knowledge'). 전체 화면, PC 3단: 메뉴 | 본문 | 출석·최근 노트.
   게임 요소 없음 — 매일 하나 읽고, 저장하고, 노트로 정리하는 개인 학습 공간.
   콘텐츠: lib/knowledgeData (지금은 mock), 개인 기록: lib/knowledgeStore (지금은 localStorage). */

const rid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

export default function KnowledgeScreen({ back }) {
  const { S } = useStore()
  const st = useKnowledgeStore(S.uid)
  const [view, setView] = useState('today')   // today | browse | detail | notes | editor | saved | attendance
  const [openId, setOpenId] = useState(null)
  const [note, setNote] = useState(null)      // 편집 중인 노트
  const t = today(), todayK = todayKnowledge(t)
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev } }, [])
  useEffect(() => { document.querySelector('.kn-main')?.scrollTo?.({ top: 0 }) }, [view, openId])

  const go = v => { setView(v); setNote(null) }
  const open = id => { setOpenId(id); setView('detail'); st.addRecent(id) }
  const writeNote = k => { setNote({ id: rid(), title: k ? k.title : '', body: '', tags: k ? [...k.tags] : [], relatedId: k?.id || null }); setView('editor') }
  const editNote = id => { setNote(st.notes.find(n => n.id === id)); setView('editor') }
  const article = (k, date) => (
    <KnowledgeArticle k={k} date={date} saved={!!st.saved[k.id]} onSave={() => st.toggleSave(k.id)} onNote={() => writeNote(k)}
      attended={!!st.attendance[t]} onAttend={k.id === todayK.id ? () => st.markAttend(t) : null} />
  )

  let main
  if (view === 'today') main = <div className="kn-page"><h2 className="kn-h2">오늘의 상식</h2>{article(todayK, t)}</div>
  else if (view === 'detail') {
    const k = getKnowledge(openId)
    main = <div className="kn-page"><button className="kn-back" onClick={() => go('browse')}>‹ 상식 둘러보기</button>{k ? article(k) : <p className="kn-empty">상식을 찾지 못했어요.</p>}</div>
  } else if (view === 'browse') main = (
    <KnowledgeBrowser items={listKnowledge()} onOpen={open}>
      <RecentKnowledge ids={st.recent} get={getKnowledge} onOpen={open} />
    </KnowledgeBrowser>
  )
  else if (view === 'saved') main = <SavedKnowledge st={st} onOpen={open} />
  else if (view === 'notes') main = <KnowledgeNoteList notes={st.notes} onNew={() => writeNote(null)} onOpen={editNote} />
  else if (view === 'editor' && note) main = (
    <KnowledgeNoteEditor key={note.id} note={note} related={note.relatedId ? getKnowledge(note.relatedId) : null}
      onSave={n => { st.saveNote(n); go('notes') }} onDelete={() => { st.deleteNote(note.id); go('notes') }} onCancel={() => go('notes')} onOpenRelated={open} />
  )
  else if (view === 'attendance') main = (
    <div className="kn-page">
      <h2 className="kn-h2">출석 기록</h2>
      <p className="kn-muted">상식을 공부한 날을 기록해요. 오늘의 상식을 읽고 "오늘 공부 완료 기록"을 누르면 표시돼요.</p>
      <AttendanceCalendar attendance={st.attendance} today={t} big />
      <section className="kn-block">
        <h3 className="kn-h3">공부한 날</h3>
        <div className="kn-days">{Object.keys(st.attendance).sort().reverse().slice(0, 30).map(d => <span key={d} className="kn-chip">{dotDate(d)}</span>)}</div>
        {!Object.keys(st.attendance).length && <p className="kn-empty">아직 기록이 없어요.</p>}
      </section>
    </div>
  )

  const recentNotes = [...st.notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5)
  return (
    <div className="kn-screen">
      <header className="kn-top">
        <button className="btn sm" onClick={back}>‹ 돌아가기</button>
        <div><h1 className="kn-brand">상식</h1><p className="kn-muted">매일 하나씩, 알아두면 좋은 지식을 쌓아보세요.</p></div>
      </header>
      <div className="kn-layout">
        <KnowledgeSidebar view={view} go={go} />
        <main className="kn-main">{main}</main>
        <aside className="kn-aside">
          <section className="kn-box">
            <h3 className="kn-h3">이번 달 출석</h3>
            <AttendanceCalendar attendance={st.attendance} today={t} />
          </section>
          <section className="kn-box">
            <h3 className="kn-h3">최근 작성한 노트</h3>
            {recentNotes.length ? recentNotes.map(n => (
              <button key={n.id} className="kn-link block" onClick={() => editNote(n.id)}><span>{n.title || '제목 없음'}</span><small className="kn-muted">{shortDate(n.updatedAt)}</small></button>
            )) : <p className="kn-empty small">아직 노트가 없어요.</p>}
            <button className="kn-more" onClick={() => go('notes')}>전체 보기 ›</button>
          </section>
        </aside>
      </div>
    </div>
  )
}

function SavedKnowledge({ st, onOpen }) {
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const list = Object.entries(st.saved).sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .map(([id, at]) => ({ k: getKnowledge(id), at })).filter(x => x.k && matchKnowledge(x.k, q, cat))
  return (
    <div className="kn-page">
      <h2 className="kn-h2">저장한 상식</h2>
      <CategoryFilter cat={cat} setCat={setCat} />
      <input className="inp kn-search" value={q} onChange={e => setQ(e.target.value)} placeholder="저장한 상식 검색" aria-label="저장한 상식 검색" />
      <div className="kn-grid">{list.map(({ k, at }) => (
        <KnowledgeCard key={k.id} k={k} onOpen={onOpen} extra={<>
          <span className="kn-note-ex">{k.summary}</span>
          <span className="kn-tags small">{k.tags.map(t => <span key={t}>#{t}</span>)}</span>
          <span className="kn-muted">{dotDate(at)} 저장</span>
        </>} />
      ))}</div>
      {!list.length && <p className="kn-empty">{Object.keys(st.saved).length ? '조건에 맞는 상식이 없어요.' : '아직 저장한 상식이 없어요. 상식을 읽고 "저장하기"를 눌러 보세요.'}</p>}
      <RecentKnowledge ids={st.recent} get={getKnowledge} onOpen={onOpen} />
    </div>
  )
}
