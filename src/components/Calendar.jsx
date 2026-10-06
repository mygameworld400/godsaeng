import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, today } from '../lib/date'
import { stat } from '../lib/stats'
import { Help } from './common'

/* 오늘 탭 맨 위 달력. 두 가지 보기:
   - 일정(기본): 칸마다 일정 제목. 날짜를 누르면 일정 말풍선(ScheduleBubble)이 그 날로 바뀐다
   - 달성률: 칸마다 그날 달성률만
   어느 보기든 날짜를 누르면 아래 루틴·투두·일기도 그 날로 바뀐다.
   보기 선택은 이 브라우저에만 기억한다 (localStorage). */

const MODE_KEY = 'godsaeng-cal-mode'
const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'plan' } catch { return 'plan' } }
const inRange = (e, ds) => e.start <= ds && ds <= e.end

export default function Calendar() {
  const { S, act } = useStore()
  const [ym, setYm] = useState(S.date.slice(0, 7))
  const [mode, setModeState] = useState(readMode)
  useEffect(() => { act.loadMonth(ym) }, [ym, act])
  // 다른 곳에서 날짜를 옮기면(‹ › 버튼) 달력도 따라간다
  useEffect(() => { setYm(S.date.slice(0, 7)) }, [S.date])
  const setMode = m => { setModeState(m); try { localStorage.setItem(MODE_KEY, m) } catch { /* 저장 못 해도 동작 */ } }

  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate(), t = today()
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  const evs = Object.values(S.events).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : a.title.localeCompare(b.title))
  const plan = mode === 'plan'

  const cells = []
  for (let i = 0; i < first; i++) cells.push(<div key={'o' + i} className="d out" aria-hidden="true" />)
  for (let n = 1; n <= last; n++) {
    const ds = ym + '-' + String(n).padStart(2, '0'), day = S.days[ds]
    const s = day ? stat(S.me, day, ds === t) : null
    const dayEvs = plan ? evs.filter(e => inRange(e, ds)) : []
    const cls = 'd' + (ds === t ? ' today' : '') + (ds === S.date ? ' sel' : '') + ((first + n - 1) % 7 === 0 ? ' sun' : '') + (plan ? ' plan' : '')
    cells.push(
      <button key={ds} className={cls} onClick={() => { act.setDateTo(ds); if (plan && !S.bubbleOpen) act.setBubble(true) }} aria-pressed={ds === S.date}
        aria-label={`${m}월 ${n}일` + (plan ? (dayEvs.length ? ` 일정 ${dayEvs.map(e => e.title).join(', ')}` : '') : (s?.tot ? ` 달성 ${s.pct}%` : ''))}>
        <span className="n">{n}</span>
        {plan
          ? <span className="evs">
              {dayEvs.slice(0, 2).map(e => (
                <span key={e.id} className={'ev' + (e.start === ds ? ' s' : '') + (e.end === ds ? ' e' : '')} style={{ background: `var(--${e.color})` }}>
                  {e.start === ds || (first + n - 1) % 7 === 0 ? e.title : ' '}
                </span>
              ))}
              {dayEvs.length > 2 && <span className="more">+{dayEvs.length - 2}</span>}
            </span>
          : s?.tot ? <span className="big">{s.pct}%</span> : null}
      </button>,
    )
  }


  return (
    <section className="sheet">
      <div className="row between">
        <h2><span>{y}년 {m}월</span>
          <Help>{plan ? '날짜를 누르면 오른쪽 일정 말풍선에서 그날 일정을 보고 추가할 수 있어요. 여러 날 이어지는 일정(예: 7일~9일 휴가)도 돼요.' : '칸마다 그날 루틴·투두 달성률이 보여요.'}</Help></h2>
        <div className="row">
          <button className="btn sm hl" onClick={() => setMode(plan ? 'rate' : 'plan')}>{plan ? '📊 달성률 보기' : '📅 일정 보기'}</button>
          <button className="btn sm" aria-label="지난달" onClick={() => move(-1)}>‹</button>
          {ym !== t.slice(0, 7) && <button className="btn sm" onClick={() => { setYm(t.slice(0, 7)); act.setDateTo(t) }}>이번 달</button>}
          <button className="btn sm" aria-label="다음달" onClick={() => move(1)}>›</button>
        </div>
      </div>
      <div className={'cal' + (plan ? ' plan' : ' rate')}>
        {[...WD].map((w, i) => <div key={w} className={'wd' + (i === 0 ? ' sun' : '')}>{w}</div>)}
        {cells}
      </div>

    </section>
  )
}
