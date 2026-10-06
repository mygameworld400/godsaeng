import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, today, toD } from '../lib/date'
import { stat } from '../lib/stats'
import { COLORS, ConfirmX, Help, formVals } from './common'

/* 오늘 탭 맨 위 달력. 두 가지 보기:
   - 일정(기본): 칸마다 일정 제목. 날짜를 누르면 아래에 그날 일정과 추가 칸이 열린다
   - 달성률: 칸마다 그날 달성률만
   어느 보기든 날짜를 누르면 아래 루틴·투두·일기도 그 날로 바뀐다.
   보기 선택은 이 브라우저에만 기억한다 (localStorage). */

const MODE_KEY = 'godsaeng-cal-mode'
const readMode = () => { try { return localStorage.getItem(MODE_KEY) || 'plan' } catch { return 'plan' } }
const md = s => s.slice(5).replace('-', '.')
const inRange = (e, ds) => e.start <= ds && ds <= e.end

function EventForm({ init, date, onSave, onCancel }) {
  const [color, setColor] = useState(init?.color || 'c4')
  const [multi, setMulti] = useState(!!init && init.end !== init.start)
  const submit = e => {
    const v = formVals(e)
    if (!v.title) return
    onSave({ title: v.title, start: v.start || date, end: multi && v.end ? v.end : v.start || date, color })
    if (!init) { e.currentTarget.reset(); setMulti(false) }
  }
  return (
    <form className="evform" onSubmit={submit}>
      <input className="inp" name="title" maxLength={40} defaultValue={init?.title || ''} placeholder="일정 (예: 휴가)" aria-label="일정 제목" autoFocus={!!init} required />
      <div className="row">
        <input className="inp" type="date" name="start" defaultValue={init?.start || date} key={'s' + date} aria-label="시작 날짜" style={{ width: 'auto' }} />
        {multi
          ? <>~<input className="inp" type="date" name="end" defaultValue={init?.end !== init?.start ? init?.end : ''} aria-label="끝 날짜" style={{ width: 'auto' }} />
              <button type="button" className="x" onClick={() => setMulti(false)}>하루만</button></>
          : <button type="button" className="btn sm" onClick={() => setMulti(true)}>+ 여러 날</button>}
        <span className="row" role="radiogroup" aria-label="색" style={{ gap: 4 }}>
          {COLORS.map(c => <button key={c} type="button" className={'swatch' + (color === c ? ' on' : '')} style={{ background: `var(--${c})` }} aria-pressed={color === c} aria-label={'색 ' + c} onClick={() => setColor(c)} />)}
        </span>
        <button className="btn pri sm">{init ? '저장' : '추가'}</button>
        {onCancel && <button type="button" className="btn sm" onClick={onCancel}>취소</button>}
      </div>
    </form>
  )
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
      <button key={ds} className={cls} onClick={() => act.setDateTo(ds)} aria-pressed={ds === S.date}
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

  const selEvs = evs.filter(e => inRange(e, S.date))
  const selLabel = `${Number(S.date.slice(5, 7))}월 ${Number(S.date.slice(8))}일 (${WD[toD(S.date).getDay()]})`

  return (
    <section className="sheet">
      <div className="row between">
        <h2><span>{y}년 {m}월</span>
          <Help>{plan ? '날짜를 누르면 아래에서 그날 일정을 추가할 수 있어요. 여러 날 이어지는 일정(예: 7일~9일 휴가)도 돼요.' : '칸마다 그날 루틴·투두 달성률이 보여요.'}</Help></h2>
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

      {plan && (
        <div className="evpanel">
          <h3 className="evh">{selLabel} 일정</h3>
          {selEvs.length ? selEvs.map(e => editing === e.id ? (
            <EventForm key={e.id} init={e} date={S.date} onCancel={() => setEditing(null)} onSave={p => { act.updateEvent(e.id, p); setEditing(null) }} />
          ) : (
            <div key={e.id} className="item">
              <span className="cdot" style={{ background: `var(--${e.color})` }} />
              <span className="t">{e.title}</span>
              <span className="sub">{e.start === e.end ? md(e.start) : `${md(e.start)} ~ ${md(e.end)}`}</span>
              <button className="x" aria-label="수정" onClick={() => setEditing(e.id)}>✎</button>
              <ConfirmX onConfirm={() => act.delEvent(e.id)} />
            </div>
          )) : <p className="empty" style={{ padding: '4px 0' }}>이 날은 일정이 없어요.</p>}
          {!editing && <EventForm date={S.date} onSave={act.addEvent} />}
        </div>
      )}
    </section>
  )
}
