import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, today, toD } from '../lib/date'
import { stat } from '../lib/stats'
import { ConfirmX, Help } from './common'
import EventForm from './EventForm'

/* 오늘 탭 맨 위 달력. 두 가지 보기:
   - 일정(기본): 칸마다 일정 제목. 날짜를 누르면 일정 말풍선(ScheduleBubble)이 그 날로 바뀐다
   - 달성률: 칸마다 그날 달성률만
   어느 보기든 날짜를 누르면 아래 루틴·투두·일기도 그 날로 바뀐다.
   보기 선택은 이 브라우저에만 기억한다 (localStorage). */

const MODE_KEY = 'godsaeng-cal-mode'
const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'plan' } catch { return 'plan' } }
const inRange = (e, ds) => e.start <= ds && ds <= e.end
const tm = e => e.time ? (e.endTime ? `${e.time}~${e.endTime} ` : `${e.time} `) : ''
const md = s => s.slice(5).replace('-', '.')

/** 달력 칸에 보이기/숨기기 */
function EyeBtn({ e }) {
  const { act } = useStore()
  return <button className={'x eye' + (e.hidden ? ' off' : '')} aria-pressed={!e.hidden} title={e.hidden ? '달력에 안 보여요 (눌러서 보이기)' : '달력에 보여요 (눌러서 숨기기)'}
    onClick={() => act.toggleEventShown(e.id)}>{e.hidden ? '🙈' : '👁'}</button>
}

export default function Calendar() {
  const { S, act } = useStore()
  const [ym, setYm] = useState(S.date.slice(0, 7))
  const [mode, setModeState] = useState(readMode)
  const [editing, setEditing] = useState(null)
  useEffect(() => { act.loadMonth(ym) }, [ym, act])
  // 다른 곳에서 날짜를 옮기면(‹ › 버튼) 달력도 따라간다
  useEffect(() => { setYm(S.date.slice(0, 7)); setEditing(null) }, [S.date])
  const setMode = m => { setModeState(m); try { localStorage.setItem(MODE_KEY, m) } catch { /* 저장 못 해도 동작 */ } }

  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate(), t = today()
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  const evs = Object.values(S.events).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : (a.time || '').localeCompare(b.time || '') || a.title.localeCompare(b.title))
  const plan = mode === 'plan'

  const cells = []
  for (let i = 0; i < first; i++) cells.push(<div key={'o' + i} className="d out" aria-hidden="true" />)
  for (let n = 1; n <= last; n++) {
    const ds = ym + '-' + String(n).padStart(2, '0'), day = S.days[ds]
    const s = day ? stat(S.me, day, ds === t) : null
    const dayEvs = plan ? evs.filter(e => !e.hidden && inRange(e, ds)) : []  // 숨긴 일정은 칸에 안 보임
    const cls = 'd' + (ds === t ? ' today' : '') + (ds === S.date ? ' sel' : '') + ((first + n - 1) % 7 === 0 ? ' sun' : '') + (plan ? ' plan' : '')
    cells.push(
      <button key={ds} className={cls} onClick={() => act.setDateTo(ds)} aria-pressed={ds === S.date}
        aria-label={`${m}월 ${n}일` + (plan ? (dayEvs.length ? ` 일정 ${dayEvs.map(e => e.title).join(', ')}` : '') : (s?.tot ? ` 달성 ${s.pct}%` : ''))}>
        <span className="n">{n}</span>
        {plan
          ? <span className="evs">
              {dayEvs.slice(0, 2).map(e => (
                <span key={e.id} className={'ev' + (e.start === ds ? ' s' : '') + (e.end === ds ? ' e' : '')} style={{ background: `var(--${e.color})` }}>
                  {e.start === ds || (first + n - 1) % 7 === 0 ? (e.start === ds && e.time ? e.time + ' ' : '') + e.title : ' '}
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
          <Help>{plan ? '날짜를 누르면 달력 아래에서 그날 일정을 추가·수정할 수 있어요. 여러 날 이어지는 일정(예: 7일~9일 휴가)도 되고, 시간도 넣을 수 있어요. 👁 를 누르면 달력 칸에서 숨기거나 다시 보이게 해요. 오른쪽 말풍선에도 그날 일정이 보여요.' : '칸마다 그날 루틴·투두 달성률이 보여요.'}</Help></h2>
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

      {plan && (() => {
        const selEvs = evs.filter(e => inRange(e, S.date))
        return (
          <div className="evpanel">
            <h3 className="evh">{Number(S.date.slice(5, 7))}월 {Number(S.date.slice(8))}일 ({WD[toD(S.date).getDay()]}) 일정</h3>
            {selEvs.map(e => editing === e.id ? (
              <EventForm key={e.id} init={e} date={S.date} onCancel={() => setEditing(null)} onSave={p => { act.updateEvent(e.id, p); setEditing(null) }} />
            ) : (
              <div key={e.id} className="item">
                <span className="cdot" style={{ background: `var(--${e.color})` }} />
                <span className="t">{e.title}</span>
                <span className="sub">{tm(e)}{e.start === e.end ? md(e.start) : `${md(e.start)} ~ ${md(e.end)}`}</span>
                <EyeBtn e={e} />
                <button className="x" aria-label="수정" onClick={() => setEditing(e.id)}>✎</button>
                <ConfirmX onConfirm={() => act.delEvent(e.id)} />
              </div>
            ))}
            {!editing && <EventForm date={S.date} onSave={act.addEvent} />}
          </div>
        )
      })()}
    </section>
  )
}
