import { useEffect } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD } from '../lib/date'

/* 일정 말풍선: 달력에서 고른 날짜(기본 오늘)의 일정을 보여 주기만 한다 (추가·수정은 달력 아래에서).
   어느 탭에서든 화면 오른쪽에 떠 있고, 접으면 '일정'이라고만 적힌 작은 말풍선이 된다. */

const md = s => s.slice(5).replace('-', '.')
const inRange = (e, ds) => !!e.start && e.start <= ds && ds <= e.end

export default function ScheduleBubble() {
  const { S, act } = useStore()
  // 다른 탭에서도 그 달 일정이 보이도록 불러온다
  useEffect(() => { act.loadMonth(S.date.slice(0, 7)) }, [S.date, act])

  if (!S.bubbleOpen) return (
    <button className="bubble mini" onClick={() => act.setBubble(true)} aria-label="일정 말풍선 펼치기">일정</button>
  )

  const evs = Object.values(S.events).filter(e => inRange(e, S.date)).sort((a, b) => a.start < b.start ? -1 : 1)
  const undated = Object.values(S.events).filter(e => !e.start)
  const label = `${Number(S.date.slice(5, 7))}월 ${Number(S.date.slice(8))}일 (${WD[toD(S.date).getDay()]})`

  return (
    <aside className="bubble" aria-label={label + ' 일정'}>
      <div className="bubble-in">
        <div className="row between">
          <h3 className="evh">{label}</h3>
          <button className="x" onClick={() => act.setBubble(false)}>접기</button>
        </div>
        {evs.length ? evs.map(e => (
          <div key={e.id} className="item">
            <span className="cdot" style={{ background: `var(--${e.color})` }} />
            <span className="t">{e.title}</span>
            <span className="sub">{e.start === e.end ? '' : `${md(e.start)} ~ ${md(e.end)}`}</span>
          </div>
        )) : <p className="empty" style={{ padding: '2px 0' }}>일정이 없어요.</p>}
        {undated.length > 0 && <>
          <p className="sub" style={{ marginTop: 6 }}>날짜 없는 일정</p>
          {undated.map(e => (
            <div key={e.id} className="item">
              <span className="cdot" style={{ background: `var(--${e.color})` }} />
              <span className="t">{e.title}</span>
            </div>
          ))}
        </>}
      </div>
    </aside>
  )
}
