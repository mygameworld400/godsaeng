import { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmX, Help } from './common'
import Md from './Md'
import { chime, unlockAudio } from '../lib/chime'

/* 활동 플랜 템플릿 보기·편집 (예: 일본어 12주).

   tpl v2 (gs_plan_templates.data):
     { version: 2, title, summary, weeks,
       days: [{ day, week, weekdayKo, title, kind: 'lesson'|'test', goal,
                flow: [{ label, min }],                       // 진행 시간표 (스톱워치 구간)
                blocks: [ { id, type: 'text', title, body }
                        | { id, type: 'sounds', title, items: [string] }
                        | { id, type: 'words' | 'examples', title, items: [{ jp, read, mean }] }
                        | { id, type: 'quiz', title, items: [{ id, type, q, a }] } ] }],
       cards: [{ front, back, weeks[] }], intro: [{ title, body }], refs: [{ title, body }] }
   v1(가져오기 스크립트 결과)은 normalize() 가 v2 로 바꿔 읽는다. 저장하면 v2 로 저장된다.

   progress (저장은 부르는 쪽 몫. 테스트 모드는 브라우저에만):
     { day, study: {day:true}, hw: {day:true}, marks: {문항id:'o'|'x'}, answers: {문항id: 내 답}, cards: {앞면:'k'|'u'} }

   onSave(tpl) 가 있으면 편집 모드를 쓸 수 있다 (관리자 테스트 모드). */

const TABS = [['plan', '일정표'], ['day', '공부'], ['cards', '플래시카드'], ['refs', '자료실'], ['intro', '개요']]
const WD = ['월', '화', '수', '목', '금']
const rid = () => Math.random().toString(36).slice(2, 9)
const BLOCK_TYPES = [['text', '글'], ['words', '단어'], ['examples', '예문'], ['quiz', '시험'], ['sounds', '소리표']]
const EMPTY_ITEM = { words: { jp: '', read: '', mean: '' }, examples: { jp: '', read: '', mean: '' }, sounds: '', quiz: { type: '단어 뜻', q: '', a: '' } }

/* ---------- v1 → v2 ---------- */
function parseFlow(s) {
  const out = []
  for (const m of String(s || '').matchAll(/(\d+)\s*~\s*(\d+)\s*분\s*([^/.]+)/g)) out.push({ label: m[3].trim(), min: +m[2] - +m[1] })
  return out
}
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
    return { day: d.day, week: d.week, weekdayKo: d.weekdayKo, title: d.title, kind: d.kind, goal: d.goal, flow: parseFlow(d.flow), blocks }
  })
  return { version: 2, title: tpl.title, summary: tpl.summary, weeks: tpl.weeks, days, cards: tpl.cards, intro: tpl.intro, refs: tpl.refs }
}

/* ---------- 스톱워치: 진행 시간표 구간이 끝날 때마다 띠링띠링 ---------- */
const mmss = ms => { const s = Math.floor(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') }

function Stopwatch({ flow, timer, setTimer }) {
  const [, tick] = useState(0)
  const fired = useRef(new Set())
  const elapsed = timer.base + (timer.start ? Date.now() - timer.start : 0)
  // 각 구간이 끝나는 분 (누적)
  const ends = useMemo(() => { let acc = 0; return flow.map(f => (acc += f.min)) }, [flow])
  const total = ends[ends.length - 1] || 0
  const idx = ends.findIndex(e => elapsed < e * 60000)
  const cur = idx < 0 ? null : flow[idx]
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!timer.start) return
    const iv = setInterval(() => {
      tick(n => n + 1)
      const el = timer.base + Date.now() - timer.start
      ends.forEach((e, i) => {
        if (el >= e * 60000 && !fired.current.has(i)) {
          fired.current.add(i); chime()
          const next = flow[i + 1]
          setNote(next ? `${flow[i].label} 끝! 다음은 ${next.label}` : `${flow[i].label} 끝! 오늘 모임 끝이에요`)
        }
      })
    }, 250)
    return () => clearInterval(iv)
  }, [timer, ends, flow])

  const start = () => {
    unlockAudio()
    // 이미 지난 구간은 다시 울리지 않게
    fired.current = new Set(ends.map((e, i) => (elapsed >= e * 60000 ? i : -1)).filter(i => i >= 0))
    setTimer({ base: elapsed, start: Date.now() })
  }
  const pause = () => setTimer({ base: elapsed, start: null })
  const reset = () => { fired.current = new Set(); setNote(''); setTimer({ base: 0, start: null }) }

  return (
    <div className="watch">
      <div className="watch-face">
        <span className="watch-time">{mmss(elapsed)}</span>
        <span className="watch-now">{cur ? `지금: ${cur.label}` : total ? '시간표 끝' : '시간표 없음'}</span>
      </div>
      <div className="row">
        {timer.start ? <button className="btn sm" onClick={pause}>일시정지</button> : <button className="btn sm pri" onClick={start}>{elapsed ? '계속' : '시작'}</button>}
        <button className="btn sm" onClick={reset} disabled={!elapsed}>처음으로</button>
      </div>
      <div className="watch-segs" aria-label="진행 시간표">
        {flow.map((f, i) => {
          const from = i ? ends[i - 1] : 0
          return <span key={i} className={'seg' + (i === idx ? ' on' : '') + (elapsed >= ends[i] * 60000 ? ' past' : '')} style={{ flexGrow: f.min || 1 }}
            title={`${from}~${ends[i]}분 ${f.label}`}><b>{from}~{ends[i]}분</b>{f.label}</span>
        })}
      </div>
      {note && <p className="watch-note" role="status">🔔 {note}</p>}
    </div>
  )
}

/* ---------- 블록 보기 ---------- */
function BlockView({ b, pg, set, hide }) {
  const [shown, setShown] = useState({})
  if (b.type === 'text') return <p className="plan-text">{b.body}</p>
  if (b.type === 'sounds') return <div className="chips">{b.items.map((s, i) => <span key={i} className="chip plan-sound">{s}</span>)}</div>
  if (b.type === 'words') return (
    <table className="md-table plan-words">
      <thead><tr><th>단어</th><th>읽기</th><th>뜻</th></tr></thead>
      <tbody>{b.items.map((w, i) => <tr key={i}><td className="jp">{w.jp}</td><td className={hide.read ? 'veil' : ''}>{w.read}</td><td className={hide.mean ? 'veil' : ''}>{w.mean}</td></tr>)}</tbody>
    </table>
  )
  if (b.type === 'examples') return (
    <div className="plan-ex">{b.items.map((e, i) => (
      <div key={i} className="ex">
        <p className="jp">{e.jp}</p>
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
            <button className="btn sm" onClick={() => setShown({ ...shown, [q.id]: !shown[q.id] })}>{shown[q.id] ? '가리기' : '정답'}</button>
            <button className={'btn sm' + (pg.marks[q.id] === 'o' ? ' hl' : '')} aria-label="맞음" onClick={() => mark(q.id, 'o')}>○</button>
            <button className={'btn sm' + (pg.marks[q.id] === 'x' ? ' warn' : '')} aria-label="틀림" onClick={() => mark(q.id, 'x')}>✕</button>
          </div>
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
  if (b.type === 'text') return <textarea className="inp" rows={4} value={b.body} onChange={e => upd({ ...b, body: e.target.value })} aria-label="내용" />
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

function FlowEdit({ flow, upd }) {
  return (
    <div className="edit-items">
      {flow.map((f, i) => (
        <div key={i} className="edit-item">
          <input className="inp" value={f.label} onChange={e => upd(flow.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="구간 이름 (예: 시작시험)" />
          <input className="inp" type="number" min={1} max={120} value={f.min} onChange={e => upd(flow.map((x, j) => j === i ? { ...x, min: Math.max(1, +e.target.value || 1) } : x))} style={{ flex: '0 0 70px' }} aria-label="분" />분
          <button className="x" aria-label="위로" disabled={!i} onClick={() => { const a = [...flow]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; upd(a) }}>↑</button>
          <button className="x" aria-label="구간 삭제" onClick={() => upd(flow.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => upd([...flow, { label: '', min: 5 }])}>+ 구간 추가</button>
    </div>
  )
}

/* ---------- 하루 ---------- */
function DayView({ tpl, d, pg, set, go, editing, updDay, timer, setTimer }) {
  const [hide, setHide] = useState({ read: false, mean: false })
  const hasVeil = d.blocks.some(b => b.type === 'words' || b.type === 'examples')
  const updBlock = (i, nb) => updDay({ ...d, blocks: d.blocks.map((b, j) => j === i ? nb : b) })
  const moveBlock = (i, dir) => { const a = [...d.blocks], j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; updDay({ ...d, blocks: a }) }
  const addBlock = type => updDay({ ...d, blocks: [...d.blocks, { id: rid(), type, title: BLOCK_TYPES.find(t => t[0] === type)[1], ...(type === 'text' ? { body: '' } : { items: [] }) }] })

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
          <span className="edit-lbl">진행 시간표 <Help>스톱워치 구간이에요. 구간이 끝날 때마다 소리가 울려요.</Help></span>
          <FlowEdit flow={d.flow} upd={flow => updDay({ ...d, flow })} />
        </> : <>
          <h2><span>{d.kind === 'test' ? '📝 ' : ''}{d.title}</span></h2>
          {d.goal && <p><b>목표</b> {d.goal}</p>}
          {d.flow.length > 0 && <Stopwatch key={d.day} flow={d.flow} timer={timer} setTimer={setTimer} />}
        </>}
      </section>

      {!editing && hasVeil && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className={'btn sm' + (hide.read ? ' hl' : '')} onClick={() => setHide({ ...hide, read: !hide.read })}>읽기 가리기</button>
          <button className={'btn sm' + (hide.mean ? ' hl' : '')} onClick={() => setHide({ ...hide, mean: !hide.mean })}>뜻 가리기</button>
          <Help>단어와 예문의 읽기·뜻을 가려요. 가린 칸에 마우스를 올리면 잠깐 보여요.</Help>
        </div>
      )}

      {d.blocks.map((b, i) => (
        <section key={b.id} className="sheet">
          {editing ? (
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input className="inp edit-title" value={b.title} onChange={e => updBlock(i, { ...b, title: e.target.value })} aria-label="칸 이름" />
              <span className="pill">{BLOCK_TYPES.find(t => t[0] === b.type)?.[1]}</span>
              <button className="x" aria-label="위로" disabled={!i} onClick={() => moveBlock(i, -1)}>↑</button>
              <button className="x" aria-label="아래로" disabled={i === d.blocks.length - 1} onClick={() => moveBlock(i, 1)}>↓</button>
              <ConfirmX onConfirm={() => updDay({ ...d, blocks: d.blocks.filter((_, j) => j !== i) })} label="칸 삭제" className="btn sm warn" />
            </div>
          ) : <h2><span>{b.title}</span>{b.type === 'quiz' && <Help>답을 칸에 적고 '정답'을 눌러 비교한 뒤 ○/✕ 를 직접 체크해요. 단어는 뜻이 통하면, 문장은 문법과 의미가 맞으면 정답이에요.</Help>}</h2>}
          {editing ? <BlockEdit b={b} upd={nb => updBlock(i, nb)} /> : <BlockView b={b} pg={pg} set={set} hide={hide} />}
        </section>
      ))}

      {editing && (
        <div className="row">
          <span className="sub">칸 추가:</span>
          {BLOCK_TYPES.map(([t, l]) => <button key={t} className="btn sm" onClick={() => addBlock(t)}>+ {l}</button>)}
        </div>
      )}

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

export default function PlanViewer({ tpl: raw, progress, setProgress, onSave }) {
  const base = useMemo(() => normalize(raw), [raw])
  const [draft, setDraft] = useState(null)       // 편집 중인 사본 (null = 보기)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('plan')
  const [timer, setTimer] = useState({ base: 0, start: null })  // 스톱워치 (탭을 옮겨도 계속)
  const tpl = draft || base
  const pg = { day: 1, study: {}, hw: {}, marks: {}, answers: {}, cards: {}, ...progress }
  const d = tpl.days.find(x => x.day === pg.day) || tpl.days[0]
  const both = x => pg.study[x] && pg.hw[x]
  const doneN = tpl.days.filter(x => both(x.day)).length
  const go = day => { setProgress({ ...pg, day }); setTab('day'); setTimer({ base: 0, start: null }); document.querySelector('.modal')?.scrollTo?.({ top: 0 }) }
  const updDay = nd => setDraft({ ...tpl, days: tpl.days.map(x => x.day === nd.day ? nd : x) })
  const save = async () => { setSaving(true); try { await onSave(draft); setDraft(null) } finally { setSaving(false) } }

  return (
    <div className="stack plan" style={{ gap: 14 }}>
      <section className="sheet">
        <div className="row between">
          <h2><span>{tpl.title}</span></h2>
          {onSave && (draft
            ? <div className="row"><button className="btn sm pri" disabled={saving} onClick={save}>{saving ? '저장 중…' : '편집 저장'}</button><button className="btn sm" onClick={() => setDraft(null)}>취소</button></div>
            : <button className="btn sm" onClick={() => { setDraft(structuredClone(base)); setTab('day') }}>✎ 템플릿 편집</button>)}
        </div>
        <p className="sub">{tpl.summary}</p>
        {draft && <p className="note">편집 중이에요. 칸 이름·내용을 고치고 칸·항목을 추가·삭제할 수 있어요. '편집 저장'을 눌러야 템플릿에 반영돼요.</p>}
        <div className="row">
          <span className="meter" style={{ flex: '1 1 160px' }} aria-hidden="true"><i style={{ width: (doneN / tpl.days.length * 100) + '%' }} /></span>
          <span className="pill"><b>{doneN}/{tpl.days.length}</b> 완료</span>
          <Help>공부 완료와 숙제 완료를 둘 다 체크한 날만 완료로 세요.</Help>
        </div>
        <div className="tabs">{TABS.map(([k, l]) => (
          <button key={k} className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === 'day' ? `공부 · Day ${d.day}` : l}</button>
        ))}</div>
      </section>

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
      {tab === 'intro' && tpl.intro.filter(s => s.title !== '처음 열 파일').map(s => (
        <section key={s.title} className="sheet"><h2><span>{s.title}</span></h2><Md text={s.body} /></section>
      ))}
    </div>
  )
}
