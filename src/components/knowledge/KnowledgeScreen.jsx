import { useEffect, useState } from 'react'
import { useStore } from '../../hooks/useStore'
import { today } from '../../lib/date'
import { todayKnowledge, visibleKnowledge } from '../../lib/knowledgeData'
import { useKnowledgeStore } from '../../lib/knowledgeStore'
import * as api from '../../services/knowledgeService'
import { Modal, formVals, nickOf } from '../common'
import { explain } from '../Login'
import KnowledgeAdmin from './KnowledgeAdmin'
import KnowledgeArticle from './KnowledgeArticle'
import KnowledgeBoard from './KnowledgeBoard'
import KnowledgeBrowser, { CategoryFilter, matchKnowledge } from './KnowledgeBrowser'
import { KnowledgeNoteEditor, KnowledgeNoteList } from './KnowledgeNotes'
import KnowledgeQuiz from './KnowledgeQuiz'
import { AttendanceCalendar, KnowledgeCard, KnowledgeSidebar, RecentKnowledge, dotDate, shortDate } from './parts'

/* 지식 페이지 (추천 활동 page_kind = 'knowledge'). 전체 화면, PC 3단: 메뉴 | 본문 | 출석·최근 노트.
   지식 글·퀴즈: DB, 관리자가 [관리]에서 넣음 · 형광펜 설명·공유 지식·뉴스·댓글: DB, 모두
   출석·저장·노트·퀴즈 푼 기록: 각자 브라우저 (lib/knowledgeStore) */

const rid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
let adminCodeMemo = ''   // 이번 접속 동안만 기억 (새로고침하면 다시 입력)

export default function KnowledgeScreen({ back }) {
  const { S, act } = useStore()
  const st = useKnowledgeStore(S.uid)
  const [list, setList] = useState(null)
  const [view, setView] = useState('today')   // today | browse | detail | quiz | share | news | notes | editor | saved | attendance | manage
  const [openId, setOpenId] = useState(null)
  const [note, setNote] = useState(null)      // 편집 중인 노트
  const [images, setImages] = useState({})    // 글 id → 대표 이미지 (열 때 받음)
  const [marks, setMarks] = useState({})      // 글 id → 형광펜 설명
  const [code, setCode] = useState(adminCodeMemo)
  const [askCode, setAskCode] = useState(false)
  const [codeMsg, setCodeMsg] = useState('')
  const t = today()
  const toast = e => act.toast(typeof e === 'string' ? e : explain(e))
  const nick = id => nickOf(S, id)
  const reload = () => api.listKnowledge().then(setList).catch(e => { setList([]); toast(e) })
  useEffect(() => { reload() }, [])
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev } }, [])
  useEffect(() => { document.querySelector('.kn-main')?.scrollTo?.({ top: 0 }) }, [view, openId])

  const all = list || []
  const visible = visibleKnowledge(all, t)
  const todayK = list ? todayKnowledge(all, t) : null
  const getK = id => all.find(k => k.id === id) || null
  const shownId = view === 'today' ? todayK?.id : view === 'detail' ? openId : null
  useEffect(() => {
    if (!shownId) return
    if (!(shownId in images)) api.knowledgeImage(shownId).then(img => setImages(m => ({ ...m, [shownId]: img }))).catch(() => setImages(m => ({ ...m, [shownId]: null })))
    api.listMarks(shownId).then(ms => setMarks(m => ({ ...m, [shownId]: ms }))).catch(() => {})
  }, [shownId])

  const go = v => { setView(v); setNote(null) }
  const open = id => { setOpenId(id); setView('detail'); st.addRecent(id) }
  const writeNote = k => { setNote({ id: rid(), title: k ? k.title : '', body: '', tags: k ? [...k.tags] : [], relatedId: k?.id || null }); setView('editor') }
  const editNote = id => { setNote(st.notes.find(n => n.id === id)); setView('editor') }
  const addMark = async m => { const r = await api.addMark(S.uid, { ...m, knowledgeId: shownId }); setMarks(x => ({ ...x, [shownId]: [...(x[shownId] || []), r] })) }
  const delMark = async m => {
    try { await api.deleteMark(m.id, m.userId === S.uid ? null : code); setMarks(x => ({ ...x, [m.knowledgeId]: (x[m.knowledgeId] || []).filter(y => y.id !== m.id) })) } catch (e) { toast(e) }
  }
  const article = (k, date) => (
    <KnowledgeArticle k={k} image={images[k.id]} date={date} saved={!!st.saved[k.id]} onSave={() => st.toggleSave(k.id)} onNote={() => writeNote(k)}
      attended={!!st.attendance[t]} onAttend={k.id === todayK?.id ? () => st.markAttend(t) : null}
      marks={marks[k.id] || []} onAddMark={S.uid ? addMark : null} onDeleteMark={delMark} canDelete={m => m.userId === S.uid || !!code} nick={nick} />
  )
  const enterAdmin = async e => {
    const v = formVals(e)
    if (!v.code) return
    try { await api.adminCheck(v.code); adminCodeMemo = v.code; setCode(v.code); setAskCode(false); setCodeMsg(''); go('manage') } catch (err) { setCodeMsg(explain(err)) }
  }

  let main
  if (list === null) main = <div className="kn-page"><p className="kn-empty">불러오는 중…</p></div>
  else if (view === 'today') main = (
    <div className="kn-page">
      <h2 className="kn-h2">오늘의 지식</h2>
      {todayK ? article(todayK, t) : <p className="kn-empty">아직 지식 글이 없어요.{code ? ' [관리]에서 넣어 주세요.' : ''}</p>}
    </div>
  )
  else if (view === 'detail') {
    const k = getK(openId)
    main = <div className="kn-page"><button className="kn-back" onClick={() => go('browse')}>‹ 지식 둘러보기</button>{k ? article(k, k.day) : <p className="kn-empty">지식을 찾지 못했어요.</p>}</div>
  } else if (view === 'browse') main = (
    <KnowledgeBrowser items={visible} onOpen={open}>
      <RecentKnowledge ids={st.recent} get={getK} onOpen={open} />
    </KnowledgeBrowser>
  )
  else if (view === 'quiz') main = <KnowledgeQuiz st={st} toast={toast} />
  else if (view === 'share' || view === 'news') main = <KnowledgeBoard kind={view} uid={S.uid} nick={nick} adminCode={code} toast={toast} />
  else if (view === 'saved') main = <SavedKnowledge st={st} getK={getK} onOpen={open} />
  else if (view === 'notes') main = <KnowledgeNoteList notes={st.notes} onNew={() => writeNote(null)} onOpen={editNote} />
  else if (view === 'editor' && note) main = (
    <KnowledgeNoteEditor key={note.id} note={note} related={note.relatedId ? getK(note.relatedId) : null}
      onSave={n => { st.saveNote(n); go('notes') }} onDelete={() => { st.deleteNote(note.id); go('notes') }} onCancel={() => go('notes')} onOpenRelated={open} />
  )
  else if (view === 'attendance') main = (
    <div className="kn-page">
      <h2 className="kn-h2">출석 기록</h2>
      <p className="kn-muted">지식을 공부한 날을 기록해요. 오늘의 지식을 읽고 "오늘 공부 완료 기록"을 누르면 표시돼요.</p>
      <AttendanceCalendar attendance={st.attendance} today={t} big />
      <section className="kn-block">
        <h3 className="kn-h3">공부한 날</h3>
        <div className="kn-days">{Object.keys(st.attendance).sort().reverse().slice(0, 30).map(d => <span key={d} className="kn-chip">{dotDate(d)}</span>)}</div>
        {!Object.keys(st.attendance).length && <p className="kn-empty">아직 기록이 없어요.</p>}
      </section>
    </div>
  )
  else if (view === 'manage' && code) main = <KnowledgeAdmin code={code} list={all} reload={reload} toast={toast} today={t} />

  const recentNotes = [...st.notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 5)
  return (
    <div className="kn-screen">
      <header className="kn-top">
        <button className="btn sm" onClick={back}>‹ 돌아가기</button>
        <div><h1 className="kn-brand">지식</h1><p className="kn-muted">매일 하나씩, 알아두면 좋은 지식을 쌓아보세요.</p></div>
        <span className="kn-grow" />
        {(code
          ? <span className="row" style={{ gap: 6 }}>
              <button className={'btn sm' + (view === 'manage' ? ' hl' : '')} onClick={() => go('manage')}>⚙ 관리</button>
              <button className="x" onClick={() => { adminCodeMemo = ''; setCode(''); if (view === 'manage') go('today') }}>관리 나가기</button>
            </span>
          : <button className="btn sm" onClick={() => setAskCode(true)}>⚙ 관리</button>)}
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
      {askCode && (
        <Modal title="지식 관리" onClose={() => { setAskCode(false); setCodeMsg('') }}>
          <form className="addf" onSubmit={enterAdmin}>
            <input className="inp" name="code" type="password" autoComplete="off" placeholder="관리자 코드" aria-label="관리자 코드" autoFocus />
            <button className="btn pri">들어가기</button>
            {codeMsg && <p className="sub" role="alert" style={{ flexBasis: '100%' }}>{codeMsg}</p>}
          </form>
        </Modal>
      )}
    </div>
  )
}

function SavedKnowledge({ st, getK, onOpen }) {
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const list = Object.entries(st.saved).sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .map(([id, at]) => ({ k: getK(id), at })).filter(x => x.k && matchKnowledge(x.k, q, cat))
  return (
    <div className="kn-page">
      <h2 className="kn-h2">저장한 지식</h2>
      <CategoryFilter cat={cat} setCat={setCat} />
      <input className="inp kn-search" value={q} onChange={e => setQ(e.target.value)} placeholder="저장한 지식 검색" aria-label="저장한 지식 검색" />
      <div className="kn-grid">{list.map(({ k, at }) => (
        <KnowledgeCard key={k.id} k={k} onOpen={onOpen} extra={<>
          <span className="kn-note-ex">{k.summary}</span>
          <span className="kn-tags small">{k.tags.map(t => <span key={t}>#{t}</span>)}</span>
          <span className="kn-muted">{dotDate(at)} 저장</span>
        </>} />
      ))}</div>
      {!list.length && <p className="kn-empty">{Object.keys(st.saved).length ? '조건에 맞는 지식이 없어요.' : '아직 저장한 지식이 없어요. 지식을 읽고 "저장하기"를 눌러 보세요.'}</p>}
      <RecentKnowledge ids={st.recent} get={getK} onOpen={onOpen} />
    </div>
  )
}
