import { useEffect, useMemo, useState } from 'react'
import { ConfirmX, Help } from './common'
import Md from './Md'
import { speak, canSpeak } from '../lib/speak'
import HandPad from './HandPad'

/* 활동 플랜 템플릿 보기·편집 (예: 일본어 12주).

   tpl v2 (gs_plan_templates.data):
     { version: 2, title, summary, weeks,
       days: [{ day, week, weekdayKo, title, kind: 'lesson'|'test', goal,
                blocks: [ { id, type: 'heading', title }                // 단계 제목 (① 지난 수업 시험 …)
                        | { id, type: 'notes', title, body }               // body = 안내, 내용은 각자 progress.notes
                        | { id, type: 'text', title, body }
                        | { id, type: 'sounds', title, items: [string] }
                        | { id, type: 'words' | 'examples', title, items: [{ jp, read, mean }] }
                        | { id, type: 'quiz', title, items: [{ id, type, q, a }] } ] }],
       cards: [{ front, back, weeks[] }], intro: [{ title, body }], refs: [{ title, body }] }
   v1(가져오기 스크립트 결과)은 normalize() 가 v2 로 바꿔 읽는다. 저장하면 v2 로 저장된다.

   progress (저장은 부르는 쪽 몫. 테스트 모드는 브라우저에만):
     { day, study: {day:true}, hw: {day:true}, marks: {문항id:'o'|'x'}, answers: {문항id: 내 답},
       notes: {day: 오답노트}, time: {day: 공부한 ms}, cards: {앞면:'k'|'u'} }

   onSave(tpl) 가 있으면 편집 모드를 쓸 수 있다 (관리자 테스트 모드).
   people: [{ id, nick, ava, progress }] 함께하는 사람들 (제목 옆 표시 + '모두' 탭). */

const TABS = [['all', '모두'], ['plan', '일정표'], ['day', '공부'], ['cards', '플래시카드'], ['refs', '자료실'], ['intro', '개요']]
const WD = ['월', '화', '수', '목', '금']
const rid = () => Math.random().toString(36).slice(2, 9)
const BLOCK_TYPES = [['heading', '단계 제목'], ['text', '글'], ['words', '단어'], ['examples', '예문'], ['quiz', '시험'], ['sounds', '소리표'], ['notes', '오답노트']]
const EMPTY_ITEM = { words: { jp: '', read: '', mean: '' }, examples: { jp: '', read: '', mean: '' }, sounds: '', quiz: { type: '단어 뜻', q: '', a: '' } }

/* ---------- v1 → v2 ---------- */
export function normalize(tpl) {
  if (tpl.version >= 2) return tpl
  const days = tpl.days.map(d => {
    const test = d.kind === 'test', blocks = []
    if (d.explain) blocks.push({ id: rid(), type: 'text', title: '오늘의 설명', body: d.explain })
    if (d.sounds?.length) blocks.push({ id: rid(), type: 'sounds', title: '소리표', items: d.sounds })
    if (d.words?.length) blocks.push({ id: rid(), type: 'words', title: '단어', items: d.words })
    if (d.examples?.length) blocks.push({ id: rid(), type: 'examples', title: '예문', items: d.examples })
    if (test ? d.speaking : d.practice) blocks.push({ id: rid(), type: 'text', title: test ? '주간 말하기' : '짝 연습 (7분)', body: test ? d.speaking : d.practice })
    const qs = tpl.quiz?.[d.day] || []
    if (qs.length) blocks.push({ id: rid(), type: 'quiz', title: test ? '주간시험' : '시작시험', items: qs })
    if (d.homework || d.common) blocks.push({ id: rid(), type: 'text', title: '오늘 숙제', body: [d.homework, d.common && '공통: ' + d.common].filter(Boolean).join('\n\n') })
    return { day: d.day, week: d.week, weekdayKo: d.weekdayKo, title: d.title, kind: d.kind, goal: d.goal, blocks }
  })
  return { version: 2, title: tpl.title, summary: tpl.summary, weeks: tpl.weeks, days, cards: tpl.cards, intro: tpl.intro, refs: tpl.refs }
}

/* ---------- 공부 시간 기록 (스톱워치) ---------- */
const mmss = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60
  return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }

/** 시작하면 그날 공부 시간에 계속 더해진다. 일시정지할 때 progress.time[day] 에 저장. */
function StudyTimer({ day, pg, set, timer, setTimer }) {
  const [, tick] = useState(0)
  useEffect(() => { if (!timer.start) return; const iv = setInterval(() => tick(n => n + 1), 500); return () => clearInterval(iv) }, [timer.start])
  const saved = pg.time[day] || 0, running = timer.start && timer.day === day
  const now = saved + (running ? Date.now() - timer.start : 0)
  const total = Object.values(pg.time).reduce((a, b) => a + b, 0) + (running ? Date.now() - timer.start : 0)
  const start = () => setTimer({ day, start: Date.now() })
  const pause = () => { set({ ...pg, time: { ...pg.time, [day]: now } }); setTimer({ day: null, start: null }) }
  // 같은 스톱워치를 Day 맨 위와 맨 아래에 하나씩 둔다 (상태는 PlanViewer 의 timer·progress 를 함께 쓴다)
  return (
    <div className="watch">
      <span className="watch-time">{mmss(now)}</span>
      <div className="watch-side">
        <div className="row">
          {running ? <button className="btn pri" onClick={pause}>일시정지</button> : <button className="btn pri" onClick={start}>{saved ? '이어서 공부' : '공부 시작'}</button>}
          {!running && saved > 0 && <ConfirmX onConfirm={() => set({ ...pg, time: { ...pg.time, [day]: 0 } })} label="기록 지우기" className="btn sm" />}
        </div>
        <span className="sub">전체 공부 시간 <b className="watch-total">{mmss(total)}</b></span>
      </div>
    </div>
  )
}

/* ---------- 블록 보기 ---------- */
const Say = ({ text }) => canSpeak() && text ? <button type="button" className="say" aria-label="발음 듣기" title="발음 듣기" onClick={() => speak(text)}>🔊</button> : null
// 소리표 항목 'あ a' → 'あ'
const kanaOf = s => String(s).split(/\s+/)[0]

function BlockView({ b, day, pg, set, hide }) {
  const [shown, setShown] = useState({})
  const [pad, setPad] = useState({})  // 손글씨 칸을 연 문항
  if (b.type === 'text') return <p className="plan-text">{b.body}</p>
  if (b.type === 'notes') return <>
    {b.body && <p className="sub">{b.body}</p>}
    <textarea className="inp notes" rows={4} value={pg.notes[day] || ''} placeholder="예: きって / 내 답 kite / 작은 っ 한 박 빠짐"
      onChange={e => set({ ...pg, notes: { ...pg.notes, [day]: e.target.value } })} aria-label="오답노트" />
  </>
  if (b.type === 'sounds') return <div className="chips">{b.items.map((s, i) => (
    <button key={i} type="button" className="chip plan-sound" onClick={() => speak(kanaOf(s))} title="눌러서 듣기">{s}</button>
  ))}</div>
  if (b.type === 'words') return (
    <table className="md-table plan-words">
      <thead><tr><th>단어</th><th>읽기</th><th>뜻</th></tr></thead>
      <tbody>{b.items.map((w, i) => <tr key={i}><td className="jp">{w.jp} <Say text={w.jp} /></td><td className={hide.read ? 'veil' : ''}>{w.read}</td><td className={hide.mean ? 'veil' : ''}>{w.mean}</td></tr>)}</tbody>
    </table>
  )
  if (b.type === 'examples') return (
    <div className="plan-ex">{b.items.map((e, i) => (
      <div key={i} className="ex">
        <p className="jp">{e.jp} <Say text={e.jp} /></p>
        <p className={'sub' + (hide.read ? ' veil' : '')} tabIndex={0}>{e.read}</p>
        <p className={hide.mean ? 'veil' : ''} tabIndex={0}>{e.mean}</p>
      </div>
    ))}</div>
  )
  // quiz
  const mark = (id, v) => set({ ...pg, marks: { ...pg.marks, [id]: pg.marks[id] === v ? undefined : v } })
  const right = b.items.filter(q => pg.marks[q.id] === 'o').length, left = b.items.filter(q => !pg.marks[q.id]).length
  return <>
    <p className="sub">맞음 <b>{right}/{b.items.length}</b>{left ? ` · ${left}개 남음` : ''}</p>
    <ol className="plan-quiz">
      {b.items.map(q => (
        <li key={q.id} className={pg.marks[q.id] === 'o' ? 'ok' : pg.marks[q.id] === 'x' ? 'ng' : ''}>
          <p className="plan-q"><span className="pill">{q.type}</span> {q.q}</p>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="inp" value={pg.answers[q.id] || ''} placeholder="내 답" aria-label="내 답"
              onChange={e => set({ ...pg, answers: { ...pg.answers, [q.id]: e.target.value } })} />
            <button className={'btn sm' + (pad[q.id] ? ' hl' : '')} aria-label="손글씨" title="손글씨로 쓰기" onClick={() => setPad({ ...pad, [q.id]: !pad[q.id] })}>✍️</button>
            <button className="btn sm" onClick={() => setShown({ ...shown, [q.id]: !shown[q.id] })}>{shown[q.id] ? '가리기' : '정답'}</button>
            <button className={'btn sm' + (pg.marks[q.id] === 'o' ? ' hl' : '')} aria-label="맞음" onClick={() => mark(q.id, 'o')}>○</button>
            <button className={'btn sm' + (pg.marks[q.id] === 'x' ? ' warn' : '')} aria-label="틀림" onClick={() => mark(q.id, 'x')}>✕</button>
          </div>
          {pad[q.id] && <HandPad />}
          {shown[q.id] && <p className="plan-ans">정답: {q.a}</p>}
        </li>
      ))}
    </ol>
  </>
}

/* ---------- 블록 편집 ---------- */
function BlockEdit({ b, upd }) {
  const setItem = (i, v) => upd({ ...b, items: b.items.map((x, j) => j === i ? v : x) })
  const delItem = i => upd({ ...b, items: b.items.filter((_, j) => j !== i) })
  const addItem = () => upd({ ...b, items: [...b.items, b.type === 'quiz' ? { ...EMPTY_ITEM.quiz, id: rid() } : structuredClone(EMPTY_ITEM[b.type])] })
  if (b.type === 'heading') return null
  if (b.type === 'text' || b.type === 'notes') return <textarea className="inp" rows={b.type === 'notes' ? 2 : 4} value={b.body} onChange={e => upd({ ...b, body: e.target.value })}
    aria-label={b.type === 'notes' ? '안내 문구' : '내용'} placeholder={b.type === 'notes' ? '오답노트 위에 보일 안내 (각자 쓰는 칸은 따로 생겨요)' : ''} />
  return (
    <div className="edit-items">
      {b.items.map((it, i) => (
        <div key={i} className="edit-item">
          {b.type === 'sounds' && <input className="inp" value={it} onChange={e => setItem(i, e.target.value)} placeholder="あ a" />}
          {(b.type === 'words' || b.type === 'examples') && <>
            <input className="inp jp" value={it.jp} onChange={e => setItem(i, { ...it, jp: e.target.value })} placeholder="일본어" />
            <input className="inp" value={it.read} onChange={e => setItem(i, { ...it, read: e.target.value })} placeholder="읽기" />
            <input className="inp" value={it.mean} onChange={e => setItem(i, { ...it, mean: e.target.value })} placeholder="뜻" />
          </>}
          {b.type === 'quiz' && <>
            <input className="inp" value={it.type} onChange={e => setItem(i, { ...it, type: e.target.value })} placeholder="유형" style={{ flex: '0 0 96px' }} />
            <input className="inp" value={it.q} onChange={e => setItem(i, { ...it, q: e.target.value })} placeholder="문제" />
            <input className="inp" value={it.a} onChange={e => setItem(i, { ...it, a: e.target.value })} placeholder="정답" />
          </>}
          <button className="x" aria-label="항목 삭제" onClick={() => delItem(i)}>✕</button>
        </div>
      ))}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={addItem}>+ 항목 추가</button>
    </div>
  )
}

/* ---------- 하루 ---------- */
function DayView({ tpl, d, pg, set, go, editing, updDay, timer, setTimer }) {
  const [hide, setHide] = useState({ read: false, mean: false })
  const hasVeil = d.blocks.some(b => b.type === 'words' || b.type === 'examples')
  const updBlock = (i, nb) => updDay({ ...d, blocks: d.blocks.map((b, j) => j === i ? nb : b) })
  const moveBlock = (i, dir) => { const a = [...d.blocks], j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; updDay({ ...d, blocks: a }) }
  const addBlock = type => updDay({ ...d, blocks: [...d.blocks, { id: rid(), type, title: BLOCK_TYPES.find(t => t[0] === type)[1], ...(type === 'text' || type === 'notes' ? { body: '' } : type === 'heading' ? {} : { items: [] }) }] })

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <button className="btn sm" disabled={d.day === 1} onClick={() => go(d.day - 1)}>‹ 이전</button>
        <span className="sub">Day {String(d.day).padStart(2, '0')} · {d.week}주 {d.weekdayKo}</span>
        <button className="btn sm" disabled={d.day === tpl.days.length} onClick={() => go(d.day + 1)}>다음 ›</button>
      </div>

      <section className="sheet">
        {editing ? <>
          <label className="edit-lbl">제목<input className="inp" value={d.title} onChange={e => updDay({ ...d, title: e.target.value })} /></label>
          <label className="edit-lbl">목표<input className="inp" value={d.goal} onChange={e => updDay({ ...d, goal: e.target.value })} /></label>
        </> : <>
          <h2><span>{d.kind === 'test' ? '📝 ' : ''}{d.title}</span></h2>
          {d.goal && <p><b>목표</b> {d.goal}</p>}
          <StudyTimer day={d.day} pg={pg} set={set} timer={timer} setTimer={setTimer} />
        </>}
      </section>

      {!editing && hasVeil && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className={'btn sm' + (hide.read ? ' hl' : '')} onClick={() => setHide({ ...hide, read: !hide.read })}>읽기 가리기</button>
          <button className={'btn sm' + (hide.mean ? ' hl' : '')} onClick={() => setHide({ ...hide, mean: !hide.mean })}>뜻 가리기</button>
          <Help>단어와 예문의 읽기·뜻을 가려요. 가린 칸에 마우스를 올리면 잠깐 보여요.</Help>
        </div>
      )}

      {d.blocks.map((b, i) => b.type === 'heading' && !editing ? (
        <h3 key={b.id} className="step">{b.title}</h3>
      ) : (
        <section key={b.id} className={'sheet' + (b.type === 'heading' ? ' step-edit' : '')}>
          {editing ? (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="inp edit-title" value={b.title} onChange={e => updBlock(i, { ...b, title: e.target.value })} aria-label="칸 이름" />
              <span className="pill">{BLOCK_TYPES.find(t => t[0] === b.type)?.[1]}</span>
              <button className="x" aria-label="위로" disabled={!i} onClick={() => moveBlock(i, -1)}>↑</button>
              <button className="x" aria-label="아래로" disabled={i === d.blocks.length - 1} onClick={() => moveBlock(i, 1)}>↓</button>
              <ConfirmX onConfirm={() => updDay({ ...d, blocks: d.blocks.filter((_, j) => j !== i) })} label="칸 삭제" className="btn sm warn" />
            </div>
          ) : <h2><span>{b.title}</span>{b.type === 'quiz' && <Help>답을 칸에 적고 '정답'을 눌러 비교한 뒤 ○/✕ 를 직접 체크해요. 단어는 뜻이 통하면, 문장은 문법과 의미가 맞으면 정답이에요.</Help>}</h2>}
          {editing ? <BlockEdit b={b} upd={nb => updBlock(i, nb)} /> : <BlockView b={b} day={d.day} pg={pg} set={set} hide={hide} />}
        </section>
      ))}

      {editing && (
        <div className="row">
          <span className="sub">칸 추가:</span>
          {BLOCK_TYPES.map(([t, l]) => <button key={t} className="btn sm" onClick={() => addBlock(t)}>+ {l}</button>)}
        </div>
      )}

      {!editing && <section className="sheet"><StudyTimer day={d.day} pg={pg} set={set} timer={timer} setTimer={setTimer} /></section>}

      {!editing && (
        <section className="sheet done-box">
          <label className="toggle"><input type="checkbox" checked={!!pg.study[d.day]} onChange={() => set({ ...pg, study: { ...pg.study, [d.day]: !pg.study[d.day] } })} /> 공부 완료</label>
          <label className="toggle"><input type="checkbox" checked={!!pg.hw[d.day]} onChange={() => set({ ...pg, hw: { ...pg.hw, [d.day]: !pg.hw[d.day] } })} /> 숙제 완료</label>
        </section>
      )}
    </div>
  )
}

function Cards({ tpl, pg, set }) {
  const [week, setWeek] = useState(0)        // 0 = 전체
  const [onlyUnknown, setOnlyUnknown] = useState(false)
  const [i, setI] = useState(0)
  const [flip, setFlip] = useState(false)
  const list = tpl.cards.filter(c => (!week || c.weeks.includes(week)) && (!onlyUnknown || pg.cards[c.front] === 'u'))
  const c = list[Math.min(i, list.length - 1)]
  const known = list.filter(x => pg.cards[x.front] === 'k').length
  const answer = v => { set({ ...pg, cards: { ...pg.cards, [c.front]: v } }); setFlip(false); setI(n => (n + 1) % Math.max(1, list.length)) }
  return (
    <section className="sheet">
      <div className="row between">
        <div className="row">
          <select className="inp" value={week} onChange={e => { setWeek(+e.target.value); setI(0); setFlip(false) }} aria-label="주차">
            <option value={0}>전체</option>
            {Array.from({ length: tpl.weeks }, (_, k) => <option key={k} value={k + 1}>{k + 1}주</option>)}
          </select>
          <button className={'btn sm' + (onlyUnknown ? ' hl' : '')} onClick={() => { setOnlyUnknown(!onlyUnknown); setI(0); setFlip(false) }}>몰라요만</button>
        </div>
        <span className="pill"><b>{known}/{list.length}</b> 알아요</span>
      </div>
      {c ? <>
        <button className={'flash' + (flip ? ' back' : '')} onClick={() => setFlip(!flip)} aria-label="카드 뒤집기">
          <span className="jp">{flip ? c.back : c.front}</span>
          {!flip && canSpeak() && <span className="say big" role="button" tabIndex={0} aria-label="발음 듣기"
            onClick={e => { e.stopPropagation(); speak(c.front) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); speak(c.front) } }}>🔊</span>}
          <small className="sub">{flip ? '뒷면' : '앞면 · 눌러서 뒤집기'}</small>
        </button>
        <div className="row between">
          <button className="btn sm" onClick={() => { setI(n => (n - 1 + list.length) % list.length); setFlip(false) }}>‹</button>
          <span className="row">
            <button className="btn warn" onClick={() => answer('u')}>몰라요</button>
            <button className="btn hl" onClick={() => answer('k')}>알아요</button>
          </span>
          <span className="sub">{Math.min(i, list.length - 1) + 1} / {list.length}</span>
          <button className="btn sm" onClick={() => { setI(n => (n + 1) % list.length); setFlip(false) }}>›</button>
        </div>
      </> : <p className="empty">{onlyUnknown ? '몰라요로 표시한 카드가 없어요.' : '카드가 없어요.'}</p>}
    </section>
  )
}

export default function PlanViewer({ tpl: raw, progress, setProgress, onSave, people = [] }) {
  const base = useMemo(() => normalize(raw), [raw])
  const [draft, setDraft] = useState(null)       // 편집 중인 사본 (null = 보기)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('plan')
  const [timer, setTimer] = useState({ day: null, start: null })  // 공부 시간 기록 (탭을 옮겨도 계속)
  const tpl = draft || base
  const pg = { day: 1, study: {}, hw: {}, marks: {}, answers: {}, notes: {}, time: {}, cards: {}, ...progress }
  const d = tpl.days.find(x => x.day === pg.day) || tpl.days[0]
  const both = x => pg.study[x] && pg.hw[x]
  const doneN = tpl.days.filter(x => both(x.day)).length
  const go = day => { setProgress({ ...pg, day }); setTab('day'); document.querySelector('.plan-screen, .modal')?.scrollTo?.({ top: 0 }) }
  const updDay = nd => setDraft({ ...tpl, days: tpl.days.map(x => x.day === nd.day ? nd : x) })
  const save = async () => { setSaving(true); try { await onSave(draft); setDraft(null) } finally { setSaving(false) } }

  return (
    <div className="stack plan" style={{ gap: 14 }}>
      <section className="sheet">
        <div className="row between">
          <div className="row" style={{ gap: 10 }}>
            <h2><span>{tpl.title}</span></h2>
            {people.length > 0 && <span className="people" title={people.map(p => p.nick).join(', ')}>
              {people.slice(0, 6).map(p => <span key={p.id} className="ava s">{p.ava}</span>)}
              <small className="sub">{people.length}명 참여</small>
            </span>}
          </div>
          {onSave && (draft
            ? <div className="row"><button className="btn sm pri" disabled={saving} onClick={save}>{saving ? '저장 중…' : '편집 저장'}</button><button className="btn sm" onClick={() => setDraft(null)}>취소</button></div>
            : <button className="btn sm" onClick={() => { setDraft(structuredClone(base)); if (tab !== 'intro') setTab('day') }}>✎ 템플릿 편집</button>)}
        </div>
        <p className="sub">{tpl.summary}</p>
        {draft && <p className="note">편집 중이에요. 공부 탭에서 칸·항목을, 개요 탭에서 규칙을 고칠 수 있어요. '편집 저장'을 눌러야 템플릿에 반영돼요.</p>}
        <div className="row">
          <span className="meter" style={{ flex: '1 1 160px' }} aria-hidden="true"><i style={{ width: (doneN / tpl.days.length * 100) + '%' }} /></span>
          <span className="pill"><b>{doneN}/{tpl.days.length}</b> 완료</span>
          <Help>공부 완료와 숙제 완료를 둘 다 체크한 날만 완료로 세요.</Help>
        </div>
        <div className="tabs">{TABS.map(([k, l]) => (
          <button key={k} className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === 'day' ? `공부 · Day ${d.day}` : l}</button>
        ))}</div>
      </section>

      {tab === 'all' && (
        <section className="sheet">
          <h2><span>모두의 진행 상황</span><Help>함께하는 사람들이 어디까지 했는지예요. 공부 완료와 숙제 완료를 둘 다 체크한 Day 를 완료로 세요.</Help></h2>
          {people.length ? people.map(p => {
            const g = { study: {}, hw: {}, time: {}, ...p.progress }
            const doneDays = tpl.days.filter(x => g.study[x.day] && g.hw[x.day]).map(x => x.day)
            const last = doneDays.length ? Math.max(...doneDays) : 0
            const mins = Math.round(Object.values(g.time).reduce((a, b) => a + b, 0) / 60000)
            return (
              <div className="person" key={p.id}>
                <div className="ava s">{p.ava}</div>
                <div className="nm"><b>{p.nick}</b><span className="pbio">{last ? `Day ${last} 완료` : '아직 시작 전'}</span></div>
                <span className="meter" aria-hidden="true"><i style={{ width: (doneDays.length / tpl.days.length * 100) + '%' }} /></span>
                <span className="sub" style={{ whiteSpace: 'nowrap' }}>{doneDays.length}/{tpl.days.length}일 · {mins}분</span>
              </div>
            )
          }) : <p className="empty">아직 함께하는 사람이 없어요.</p>}
        </section>
      )}
      {tab === 'plan' && (
        <section className="sheet">
          <h2><span>12주 일정표</span><Help>칸을 누르면 그날 공부로 가요. 📝 은 금요일 주간시험이에요. 반만 칠해진 칸은 공부·숙제 중 하나만 끝낸 날이에요.</Help></h2>
          <div className="plan-grid">
            <span />{WD.map(w => <span key={w} className="sub plan-wd">{w}</span>)}
            {Array.from({ length: tpl.weeks }, (_, k) => k + 1).map(w => [
              <span key={'w' + w} className="sub plan-wk">{w}주</span>,
              ...tpl.days.filter(x => x.week === w).map(x => (
                <button key={x.day} className={'plan-cell' + (both(x.day) ? ' done' : (pg.study[x.day] || pg.hw[x.day]) ? ' half' : '') + (x.day === pg.day ? ' cur' : '') + (x.kind === 'test' ? ' test' : '')}
                  onClick={() => go(x.day)} title={`Day ${x.day} · ${x.title}`}>
                  <b>{x.kind === 'test' ? '📝' : x.day}</b><small>{x.title}</small>
                </button>
              )),
            ])}
          </div>
        </section>
      )}
      {tab === 'day' && <DayView key={d.day} tpl={tpl} d={d} pg={pg} set={setProgress} go={go} editing={!!draft} updDay={updDay} timer={timer} setTimer={setTimer} />}
      {tab === 'cards' && <Cards tpl={tpl} pg={pg} set={setProgress} />}
      {tab === 'refs' && tpl.refs.map(r => <section key={r.title} className="sheet"><h2><span>{r.title}</span></h2><Md text={r.body} /></section>)}
      {tab === 'intro' && (draft ? <>
        {tpl.intro.map((s, i) => (
          <section key={i} className="sheet">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="inp edit-title" value={s.title} onChange={e => setDraft({ ...tpl, intro: tpl.intro.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} aria-label="제목" />
              <ConfirmX onConfirm={() => setDraft({ ...tpl, intro: tpl.intro.filter((_, j) => j !== i) })} label="삭제" className="btn sm warn" />
            </div>
            <textarea className="inp" rows={6} value={s.body} onChange={e => setDraft({ ...tpl, intro: tpl.intro.map((x, j) => j === i ? { ...x, body: e.target.value } : x) })} aria-label="내용" />
          </section>
        ))}
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft({ ...tpl, intro: [...tpl.intro, { title: '새 규칙', body: '' }] })}>+ 개요 칸 추가</button>
      </> : tpl.intro.filter(s => s.title !== '처음 열 파일').map(s => (
        <section key={s.title} className="sheet"><h2><span>{s.title}</span></h2><Md text={s.body} /></section>
      )))}
    </div>
  )
}
