import { useState } from 'react'
import { Help } from './common'
import Md from './Md'

/* 활동 플랜 템플릿 보기 (예: 일본어 12주).
   tpl (gs_plan_templates.data):
     { title, summary, weeks,
       days: [{ day, week, weekdayKo, title, kind:'lesson'|'test', goal, explain, flow, sounds[], words[{jp,read,mean}],
                examples[{jp,read,mean}], practice, homework, speaking, common }],
       quiz: { [day]: [{ id, type, q, a }] },  cards: [{ front, back, weeks[] }],
       intro: [{ title, body(md) }],  refs: [{ title, body(md) }] }
   progress (저장은 부르는 쪽 몫. 테스트 모드는 브라우저에만):
     { day: 지금 보는 Day, done: {day:true}, marks: {문항id:'o'|'x'}, cards: {앞면:'k'|'u'} } */

const TABS = [['plan', '일정표'], ['day', '공부'], ['cards', '플래시카드'], ['refs', '자료실'], ['intro', '개요']]
const WD = ['월', '화', '수', '목', '금']

function Toggle({ on, onClick, children }) {
  return <button type="button" className={'btn sm' + (on ? ' hl' : '')} aria-pressed={on} onClick={onClick}>{children}</button>
}

function DayView({ tpl, d, pg, set, go }) {
  const [hideRead, setHideRead] = useState(false)
  const [hideMean, setHideMean] = useState(false)
  const [shown, setShown] = useState({})  // 정답 펼친 문항
  const qs = tpl.quiz[d.day] || []
  const marked = qs.filter(q => pg.marks[q.id]), right = qs.filter(q => pg.marks[q.id] === 'o').length
  const mark = (id, v) => set({ ...pg, marks: { ...pg.marks, [id]: pg.marks[id] === v ? undefined : v } })
  const done = !!pg.done[d.day]

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row between">
        <button className="btn sm" disabled={d.day === 1} onClick={() => go(d.day - 1)}>‹ 이전</button>
        <span className="sub">Day {String(d.day).padStart(2, '0')} · {d.week}주 {d.weekdayKo}</span>
        <button className="btn sm" disabled={d.day === tpl.days.length} onClick={() => go(d.day + 1)}>다음 ›</button>
      </div>

      <section className="sheet">
        <div className="row between">
          <h2><span>{d.kind === 'test' ? '📝 ' : ''}{d.title}</span></h2>
          <label className="toggle"><input type="checkbox" checked={done} onChange={() => set({ ...pg, done: { ...pg.done, [d.day]: !done } })} /> 이 Day 완료</label>
        </div>
        {d.goal && <p><b>목표</b> {d.goal}</p>}
        {d.explain && <p className="plan-explain">{d.explain}</p>}
        {d.flow && <details><summary className="sub">진행 시간표</summary><p className="sub">{d.flow}</p></details>}
        {d.sounds.length > 0 && <div className="chips">{d.sounds.map(s => <span key={s} className="chip plan-sound">{s}</span>)}</div>}
      </section>

      {d.words.length > 0 && (
        <section className="sheet">
          <div className="row between">
            <h2><span>단어</span></h2>
            <div className="row"><Toggle on={hideRead} onClick={() => setHideRead(!hideRead)}>읽기 가리기</Toggle><Toggle on={hideMean} onClick={() => setHideMean(!hideMean)}>뜻 가리기</Toggle></div>
          </div>
          <table className="md-table plan-words">
            <thead><tr><th>단어</th><th>읽기</th><th>뜻</th></tr></thead>
            <tbody>{d.words.map((w, i) => (
              <tr key={i}><td className="jp">{w.jp}</td><td className={hideRead ? 'veil' : ''}>{w.read}</td><td className={hideMean ? 'veil' : ''}>{w.mean}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      {d.examples.length > 0 && (
        <section className="sheet">
          <h2><span>예문</span><Help>위의 '읽기 가리기·뜻 가리기'가 예문에도 똑같이 적용돼요. 가린 칸은 눌러서 잠깐 볼 수 있어요.</Help></h2>
          <div className="plan-ex">{d.examples.map((e, i) => (
            <div key={i} className="ex">
              <p className="jp">{e.jp}</p>
              <p className={'sub' + (hideRead ? ' veil' : '')} tabIndex={0}>{e.read}</p>
              <p className={hideMean ? 'veil' : ''} tabIndex={0}>{e.mean}</p>
            </div>
          ))}</div>
        </section>
      )}

      {(d.practice || d.speaking) && (
        <section className="sheet">
          <h2><span>{d.kind === 'test' ? '주간 말하기' : '짝 연습 (7분)'}</span></h2>
          <p>{d.kind === 'test' ? d.speaking : d.practice}</p>
        </section>
      )}

      <section className="sheet">
        <div className="row between">
          <h2><span>{d.kind === 'test' ? '주간시험' : '시작시험'}</span>
            <Help>답을 먼저 떠올리거나 적은 뒤 '정답'을 눌러 확인하고 ○/✕ 를 직접 체크해요. 단어는 뜻이 통하면, 문장은 문법과 의미가 맞으면 정답이에요.</Help></h2>
          <span className="pill"><b>{right}/{qs.length}</b> 맞음{marked.length < qs.length ? ` · ${qs.length - marked.length}개 남음` : ''}</span>
        </div>
        <ol className="plan-quiz">
          {qs.map(q => (
            <li key={q.id} className={pg.marks[q.id] === 'o' ? 'ok' : pg.marks[q.id] === 'x' ? 'ng' : ''}>
              <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <span><span className="pill">{q.type}</span> {q.q}</span>
                <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                  <button className="btn sm" onClick={() => setShown({ ...shown, [q.id]: !shown[q.id] })}>{shown[q.id] ? '가리기' : '정답'}</button>
                  <button className={'btn sm' + (pg.marks[q.id] === 'o' ? ' hl' : '')} aria-label="맞음" onClick={() => mark(q.id, 'o')}>○</button>
                  <button className={'btn sm' + (pg.marks[q.id] === 'x' ? ' warn' : '')} aria-label="틀림" onClick={() => mark(q.id, 'x')}>✕</button>
                </span>
              </div>
              {shown[q.id] && <p className="plan-ans">{q.a}</p>}
            </li>
          ))}
        </ol>
      </section>

      {(d.homework || d.common) && (
        <section className="sheet">
          <h2><span>오늘 숙제</span></h2>
          {d.homework && <p>{d.homework}</p>}
          {d.common && <p className="sub">공통: {d.common}</p>}
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
          <Toggle on={onlyUnknown} onClick={() => { setOnlyUnknown(!onlyUnknown); setI(0); setFlip(false) }}>몰라요만</Toggle>
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

export default function PlanViewer({ tpl, progress, setProgress }) {
  const [tab, setTab] = useState('plan')
  const pg = { day: 1, done: {}, marks: {}, cards: {}, ...progress }
  const d = tpl.days.find(x => x.day === pg.day) || tpl.days[0]
  const doneN = Object.values(pg.done).filter(Boolean).length
  const go = day => { setProgress({ ...pg, day }); setTab('day'); document.querySelector('.modal')?.scrollTo?.({ top: 0 }) }

  return (
    <div className="stack plan" style={{ gap: 14 }}>
      <section className="sheet">
        <h2><span>{tpl.title}</span></h2>
        <p className="sub">{tpl.summary}</p>
        <div className="row">
          <span className="meter" style={{ flex: '1 1 160px' }} aria-hidden="true"><i style={{ width: (doneN / tpl.days.length * 100) + '%' }} /></span>
          <span className="pill"><b>{doneN}/{tpl.days.length}</b> 완료</span>
        </div>
        <div className="tabs">{TABS.map(([k, l]) => (
          <button key={k} className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{k === 'day' ? `공부 · Day ${d.day}` : l}</button>
        ))}</div>
      </section>

      {tab === 'plan' && (
        <section className="sheet">
          <h2><span>12주 일정표</span><Help>칸을 누르면 그날 공부로 가요. 📝 은 금요일 주간시험이에요.</Help></h2>
          <div className="plan-grid">
            <span />{WD.map(w => <span key={w} className="sub plan-wd">{w}</span>)}
            {Array.from({ length: tpl.weeks }, (_, k) => k + 1).map(w => [
              <span key={'w' + w} className="sub plan-wk">{w}주</span>,
              ...tpl.days.filter(x => x.week === w).map(x => (
                <button key={x.day} className={'plan-cell' + (pg.done[x.day] ? ' done' : '') + (x.day === pg.day ? ' cur' : '') + (x.kind === 'test' ? ' test' : '')}
                  onClick={() => go(x.day)} title={`Day ${x.day} · ${x.title}`}>
                  <b>{x.kind === 'test' ? '📝' : x.day}</b><small>{x.title}</small>
                </button>
              )),
            ])}
          </div>
        </section>
      )}
      {tab === 'day' && <DayView key={d.day} tpl={tpl} d={d} pg={pg} set={setProgress} go={go} />}
      {tab === 'cards' && <Cards tpl={tpl} pg={pg} set={setProgress} />}
      {tab === 'refs' && tpl.refs.map(r => <section key={r.title} className="sheet"><h2><span>{r.title}</span></h2><Md text={r.body} /></section>)}
      {tab === 'intro' && tpl.intro.filter(s => s.title !== '처음 열 파일').map(s => (
        <section key={s.title} className="sheet"><h2><span>{s.title}</span></h2><Md text={s.body} /></section>
      ))}
    </div>
  )
}
