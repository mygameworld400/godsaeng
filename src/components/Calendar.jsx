import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, today } from '../lib/date'
import { stat } from '../lib/stats'

/* 오늘 탭 맨 위 달력. 날짜를 누르면 그 날의 루틴·투두·일기로 바뀐다.
   칸마다 그날 달성률을 작은 막대로 보여 준다. */
export default function Calendar() {
  const { S, act } = useStore()
  const [ym, setYm] = useState(S.date.slice(0, 7))
  useEffect(() => { act.loadMonth(ym) }, [ym, act])
  // 다른 곳에서 날짜를 옮기면(‹ › 버튼) 달력도 따라간다
  useEffect(() => { setYm(S.date.slice(0, 7)) }, [S.date])

  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate(), t = today()
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }

  const cells = []
  for (let i = 0; i < first; i++) cells.push(<div key={'o' + i} className="d out" aria-hidden="true" />)
  for (let n = 1; n <= last; n++) {
    const ds = ym + '-' + String(n).padStart(2, '0'), day = S.days[ds]
    const s = day ? stat(S.me, day, ds === t) : null
    const cls = 'd' + (ds === t ? ' today' : '') + (ds === S.date ? ' sel' : '') + ((first + n - 1) % 7 === 0 ? ' sun' : '')
    cells.push(
      <button key={ds} className={cls} onClick={() => act.setDateTo(ds)} aria-label={`${m}월 ${n}일${s?.tot ? ` 달성 ${s.pct}%` : ''}`} aria-pressed={ds === S.date}>
        <span className="n">{n}</span>
        {s?.tot ? <><span className="gauge"><i style={{ width: s.pct + '%' }} /></span><span className="p">{s.pct}%</span></> : null}
      </button>,
    )
  }

  return (
    <section className="sheet">
      <div className="row between">
        <h2><span>{y}년 {m}월</span></h2>
        <div className="row">
          <button className="btn sm" aria-label="지난달" onClick={() => move(-1)}>‹</button>
          {ym !== t.slice(0, 7) && <button className="btn sm hl" onClick={() => { setYm(t.slice(0, 7)); act.setDateTo(t) }}>이번 달</button>}
          <button className="btn sm" aria-label="다음달" onClick={() => move(1)}>›</button>
        </div>
      </div>
      <div className="cal">
        {[...WD].map((w, i) => <div key={w} className={'wd' + (i === 0 ? ' sun' : '')}>{w}</div>)}
        {cells}
      </div>
    </section>
  )
}
