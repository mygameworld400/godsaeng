import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD } from '../lib/date'
import { COLORS, ConfirmX, formVals } from './common'

/* 일정 말풍선: 달력에서 고른 날짜(기본 오늘)의 일정을 보여 주고 추가·수정·삭제한다.
   어느 탭에서든 화면 오른쪽에 떠 있고, 접으면 '일정'이라고만 적힌 작은 말풍선이 된다. */

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

export default function ScheduleBubble() {
  const { S, act } = useStore()
  const [editing, setEditing] = useState(null)
  // 다른 탭에서도 그 달 일정이 보이도록 불러온다
  useEffect(() => { act.loadMonth(S.date.slice(0, 7)) }, [S.date, act])
  useEffect(() => { setEditing(null) }, [S.date])

  if (!S.bubbleOpen) return (
    <button className="bubble mini" onClick={() => act.setBubble(true)} aria-label="일정 말풍선 펼치기">일정</button>
  )

  const evs = Object.values(S.events).filter(e => inRange(e, S.date)).sort((a, b) => a.start < b.start ? -1 : 1)
  const label = `${Number(S.date.slice(5, 7))}월 ${Number(S.date.slice(8))}일 (${WD[toD(S.date).getDay()]}) 일정`

  return (
    <aside className="bubble" aria-label={label}>
      <div className="row between">
        <h3 className="evh">{label}</h3>
        <button className="x" onClick={() => act.setBubble(false)}>접기</button>
      </div>
      {evs.length ? evs.map(e => editing === e.id ? (
        <EventForm key={e.id} init={e} date={S.date} onCancel={() => setEditing(null)} onSave={p => { act.updateEvent(e.id, p); setEditing(null) }} />
      ) : (
        <div key={e.id} className="item">
          <span className="cdot" style={{ background: `var(--${e.color})` }} />
          <span className="t">{e.title}</span>
          <span className="sub">{e.start === e.end ? md(e.start) : `${md(e.start)} ~ ${md(e.end)}`}</span>
          <button className="x" aria-label="수정" onClick={() => setEditing(e.id)}>✎</button>
          <ConfirmX onConfirm={() => act.delEvent(e.id)} />
        </div>
      )) : <p className="empty" style={{ padding: '2px 0' }}>이 날은 일정이 없어요.</p>}
      {!editing && <EventForm date={S.date} onSave={act.addEvent} />}
    </aside>
  )
}
