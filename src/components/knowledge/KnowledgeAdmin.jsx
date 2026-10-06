import { useEffect, useState } from 'react'
import * as api from '../../services/knowledgeService'
import { makeBackground } from '../../lib/cutout'
import { WD } from '../../lib/date'
import { CATEGORIES } from '../../data/knowledge'
import { ConfirmX, Help } from '../common'
import { dotDate } from './parts'

/* 지식 관리 (관리자 코드로 들어옴): 날짜별 오늘의 지식 · 날짜 없는 글(둘러보기) · 퀴즈 */
export default function KnowledgeAdmin({ code, list, reload, toast, today }) {
  const [tab, setTab] = useState('know')
  const [edit, setEdit] = useState(null)   // 편집 중인 글 (새 글이면 id 없음)
  useEffect(() => { document.querySelector('.kn-main')?.scrollTo?.({ top: 0 }) }, [edit, tab])
  if (edit) return <KnowForm k={edit} code={code} list={list} toast={toast} onDone={changed => { setEdit(null); if (changed) reload() }} />
  return (
    <div className="kn-page">
      <div className="kn-row">
        <h2 className="kn-h2">지식 관리</h2>
        <div className="kn-filters">
          <button className={'kn-chip' + (tab === 'know' ? ' on' : '')} onClick={() => setTab('know')}>지식 글</button>
          <button className={'kn-chip' + (tab === 'quiz' ? ' on' : '')} onClick={() => setTab('quiz')}>퀴즈</button>
        </div>
      </div>
      {tab === 'know' ? <KnowList list={list} today={today} onEdit={setEdit} /> : <QuizAdmin code={code} toast={toast} />}
    </div>
  )
}

const blank = day => ({ day: day || '', category: CATEGORIES[0], title: '', summary: '', bodyText: '', keyPoints: [], tags: [], minutes: 2 })

function KnowList({ list, today, onEdit }) {
  const [ym, setYm] = useState(today.slice(0, 7))
  const [y, m] = ym.split('-').map(Number)
  const first = (new Date(y, m - 1, 1).getDay() + 6) % 7, last = new Date(y, m, 0).getDate()
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  const byDay = Object.fromEntries(list.filter(k => k.day).map(k => [k.day, k]))
  const filled = Object.keys(byDay).filter(d => d.startsWith(ym)).length
  const undated = list.filter(k => !k.day)
  return <>
    <section className="kn-box">
      <div className="kn-row">
        <h3 className="kn-h3" style={{ margin: 0 }}>날짜별 오늘의 지식 <Help>날짜를 누르면 그날 보여 줄 글을 넣거나 고칠 수 있어요. 글이 없는 날은 아래 '날짜 없는 글'과 지난 글 중에서 돌아가며 보여 줘요. 아직 오지 않은 날짜의 글은 그날이 되어야 보여요.</Help></h3>
        <span className="kn-muted">이번 달 {filled}일 채움</span>
      </div>
      <div className="kn-cal-h" style={{ marginTop: 10 }}>
        <button className="x" onClick={() => move(-1)} aria-label="지난달">‹</button><b>{y}년 {m}월</b><button className="x" onClick={() => move(1)} aria-label="다음달">›</button>
      </div>
      <div className="kn-mcal">
        {[...WD.slice(1), WD[0]].map(w => <span key={w} className="kn-cal-w">{w}</span>)}
        {Array.from({ length: first }, (_, i) => <span key={'o' + i} />)}
        {Array.from({ length: last }, (_, i) => {
          const ds = ym + '-' + String(i + 1).padStart(2, '0'), k = byDay[ds]
          return (
            <button key={ds} className={'kn-mday' + (k ? ' on' : '') + (ds === today ? ' today' : '')} onClick={() => onEdit(k || blank(ds))} title={k ? k.title : '비어 있음 — 눌러서 넣기'}>
              <b>{i + 1}</b>{k ? <span>{k.title}</span> : <span className="add">+</span>}
            </button>
          )
        })}
      </div>
    </section>
    <section className="kn-box">
      <div className="kn-row">
        <h3 className="kn-h3" style={{ margin: 0 }}>날짜 없는 글 <small className="kn-muted">{undated.length}개 · 둘러보기에 늘 보임</small></h3>
        <button className="btn sm" onClick={() => onEdit(blank(''))}>+ 날짜 없이 새 글</button>
      </div>
      <div className="kn-adminlist">
        {undated.map(k => <button key={k.id} className="kn-link block" onClick={() => onEdit(k)}><span>{k.title}</span><small className="kn-muted">{k.category}</small></button>)}
        {!undated.length && <p className="kn-empty small">없어요.</p>}
      </div>
    </section>
  </>
}

function KnowForm({ k, code, list, toast, onDone }) {
  const [v, setV] = useState({ ...k, keyText: k.keyPoints.join('\n'), tagText: k.tags.join(', ') })
  const [image, setImage] = useState(k.id ? undefined : null)   // undefined = 불러오는 중
  const [busy, setBusy] = useState(false)
  const set = (key, x) => setV(o => ({ ...o, [key]: x }))
  useEffect(() => { if (k.id) api.knowledgeImage(k.id).then(setImage).catch(() => setImage(null)) }, [k.id])
  const clash = v.day && list.find(x => x.day === v.day && x.id !== k.id)
  const pick = async f => { if (!f) return; try { setImage(await makeBackground(f)) } catch (e) { toast(e) } }
  const save = async () => {
    if (!v.title.trim() || clash || image === undefined) return
    setBusy(true)
    try {
      await api.adminSaveKnowledge(code, {
        id: k.id, day: v.day || null, category: v.category, title: v.title.trim(), summary: v.summary.trim(), bodyText: v.bodyText.trim(),
        keyPoints: v.keyText.split('\n').map(s => s.trim()).filter(Boolean), tags: v.tagText.split(/[,#\s]+/).map(s => s.trim()).filter(Boolean),
        minutes: Math.max(1, Math.min(60, +v.minutes || 2)), image,
      })
      toast('저장했어요.'); onDone(true)
    } catch (e) { toast(e); setBusy(false) }
  }
  return (
    <div className="kn-page kn-editor">
      <button className="kn-back" onClick={() => onDone(false)}>‹ 지식 관리</button>
      <h2 className="kn-h2">{k.id ? '지식 고치기' : '새 지식'}</h2>
      <div className="kn-form2">
        <label className="kn-label">날짜 <small>(비우면 둘러보기에만)</small>
          <span className="row" style={{ gap: 6 }}><input className="inp" type="date" value={v.day || ''} onChange={e => set('day', e.target.value)} />{v.day && <button type="button" className="x" onClick={() => set('day', '')}>비우기</button>}</span>
          {clash && <small className="kn-err">{dotDate(v.day)}에는 이미 「{clash.title}」이 있어요.</small>}
        </label>
        <label className="kn-label">카테고리
          <select className="inp" value={v.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="kn-label">읽는 시간(분)<input className="inp" type="number" min={1} max={60} value={v.minutes} onChange={e => set('minutes', e.target.value)} /></label>
      </div>
      <label className="kn-label">제목<input className="inp" value={v.title} onChange={e => set('title', e.target.value)} maxLength={200} placeholder="예: 세계에서 가장 큰 사막은 사하라가 아니다" /></label>
      <label className="kn-label">요약 <small>(제목 아래 한두 줄)</small><textarea className="inp" rows={2} value={v.summary} onChange={e => set('summary', e.target.value)} maxLength={1000} /></label>
      <div className="kn-label">대표 이미지 <small>(없어도 돼요)</small>
        <div className="row" style={{ gap: 8 }}>
          {image === undefined ? <span className="kn-muted">불러오는 중…</span> : image ? <img className="kn-thumb wide" src={image} alt="" /> : <span className="kn-muted">이미지 없음</span>}
          <label className="btn sm">{image ? '바꾸기' : '이미지 올리기'}<input type="file" accept="image/*" hidden onChange={e => pick(e.target.files[0])} /></label>
          {image && <button type="button" className="btn sm" onClick={() => setImage(null)}>이미지 빼기</button>}
        </div>
      </div>
      <label className="kn-label">본문 <small>(빈 줄로 문단을 나눠요. 문단을 크게 고치면 그 문단에 달린 형광펜 설명이 사라질 수 있어요)</small>
        <textarea className="inp kn-textarea" rows={12} value={v.bodyText} onChange={e => set('bodyText', e.target.value)} maxLength={20000} />
      </label>
      <label className="kn-label">알아두기 <small>(한 줄에 하나)</small><textarea className="inp" rows={4} value={v.keyText} onChange={e => set('keyText', e.target.value)} /></label>
      <label className="kn-label">태그 <small>(쉼표로 구분)</small><input className="inp" value={v.tagText} onChange={e => set('tagText', e.target.value)} placeholder="예: 지리, 자연" /></label>
      <div className="kn-actions">
        <button className="btn pri" onClick={save} disabled={busy || !v.title.trim() || !!clash || image === undefined}>저장</button>
        <button className="btn" onClick={() => onDone(false)}>취소</button>
        {k.id && <ConfirmX label="이 글 지우기" className="btn warn" onConfirm={async () => { try { await api.adminDeleteKnowledge(code, k.id); toast('지웠어요.'); onDone(true) } catch (e) { toast(e) } }} />}
      </div>
    </div>
  )
}

function QuizAdmin({ code, toast }) {
  const [list, setList] = useState(null)
  const load = () => api.listQuizzes().then(setList).catch(e => { setList([]); toast(e) })
  useEffect(() => { load() }, [])
  if (list === null) return <p className="kn-empty">불러오는 중…</p>
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="kn-muted">문제 {list.length}개 · 순서 숫자가 작을수록 앞이에요.</p>
      {list.map((q, i) => <QuizForm key={q.id + q.question + q.answer + q.sort + q.choices.join('|') + q.explanation} q={q} n={i + 1} code={code} toast={toast} onDone={load} />)}
      <QuizForm key={'new' + list.length} code={code} toast={toast} onDone={load} nextSort={(list.at(-1)?.sort || 0) + 1} />
    </div>
  )
}

function QuizForm({ q, n, code, toast, onDone, nextSort }) {
  const [open, setOpen] = useState(false)
  const [v, setV] = useState(q ? { ...q, choices: [...q.choices] } : { question: '', choices: ['', '', '', ''], answer: 0, explanation: '', sort: nextSort })
  const [busy, setBusy] = useState(false)
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const setChoice = (i, x) => set('choices', v.choices.map((c, j) => j === i ? x : c))
  const filled = v.choices.map(c => c.trim())
  const ok = v.question.trim() && filled.filter(Boolean).length >= 2 && filled[v.answer]
  const save = async () => {
    if (!ok) return
    // 빈 보기는 빼고, 정답 번호를 그에 맞춰 옮긴다
    const keep = filled.map((c, i) => [c, i]).filter(([c]) => c)
    setBusy(true)
    try {
      await api.adminSaveQuiz(code, { id: q?.id, question: v.question.trim(), choices: keep.map(([c]) => c), answer: keep.findIndex(([, i]) => i === v.answer), explanation: v.explanation.trim(), sort: +v.sort || 0 })
      toast(q ? '고쳤어요.' : '퀴즈를 넣었어요.'); onDone()
    } catch (e) { toast(e) }
    setBusy(false)
  }
  if (!open) return q
    ? <button className="kn-card" onClick={() => setOpen(true)}><b className="kn-card-t">Q{n}. {q.question}</b><span className="kn-card-m">정답 {q.answer + 1}번 · {q.choices[q.answer]} · 순서 {q.sort}</span></button>
    : <button className="btn" onClick={() => setOpen(true)}>+ 새 퀴즈</button>
  return (
    <section className="kn-box kn-editor stack" style={{ gap: 10 }}>
      <label className="kn-label">문제<textarea className="inp" rows={2} value={v.question} onChange={e => set('question', e.target.value)} maxLength={500} placeholder="예: 세계에서 가장 큰 사막은?" /></label>
      <div className="kn-label">보기 <small>(동그라미를 눌러 정답을 골라요 · 2~5개, 빈 칸은 빠져요)</small>
        {v.choices.map((c, i) => (
          <div key={i} className="row" style={{ gap: 6 }}>
            <input type="radio" name={'ans' + (q?.id || 'new')} checked={v.answer === i} onChange={() => set('answer', i)} aria-label={(i + 1) + '번을 정답으로'} />
            <input className="inp" value={c} onChange={e => setChoice(i, e.target.value)} placeholder={(i + 1) + '번 보기'} maxLength={200} />
            {v.choices.length > 2 && <button type="button" className="x" onClick={() => { set('choices', v.choices.filter((_, j) => j !== i)); if (v.answer >= i && v.answer > 0) set('answer', v.answer === i ? 0 : v.answer - 1) }} aria-label="보기 빼기">✕</button>}
          </div>
        ))}
        {v.choices.length < 5 && <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('choices', [...v.choices, ''])}>+ 보기 추가</button>}
      </div>
      <label className="kn-label">해설 <small>(답을 고르면 보여요)</small><textarea className="inp" rows={3} value={v.explanation} onChange={e => set('explanation', e.target.value)} maxLength={2000} /></label>
      <label className="kn-label" style={{ maxWidth: 120 }}>순서<input className="inp" type="number" value={v.sort} onChange={e => set('sort', e.target.value)} /></label>
      <div className="kn-actions">
        <button className="btn pri" onClick={save} disabled={busy || !ok}>{q ? '저장' : '넣기'}</button>
        <button className="btn" onClick={() => setOpen(false)}>닫기</button>
        {q && <ConfirmX label="지우기" className="btn warn" onConfirm={async () => { try { await api.adminDeleteQuiz(code, q.id); toast('지웠어요.'); onDone() } catch (e) { toast(e) } }} />}
      </div>
    </section>
  )
}
