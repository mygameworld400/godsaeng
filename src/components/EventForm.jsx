import { useState } from 'react'
import { COLORS, formVals } from './common'

/** 일정 추가·수정 폼. 끝 날짜를 비우면 하루짜리, '+ 여러 날'로 연속 일정. 시간은 선택(시작만 또는 시작~끝). */
export default function EventForm({ init, date, onSave, onCancel }) {
  const [color, setColor] = useState(init?.color || 'c4')
  const [multi, setMulti] = useState(!!init && init.end !== init.start)
  const [timed, setTimed] = useState(!!init?.time)
  const submit = e => {
    const v = formVals(e)
    if (!v.title) return
    const start = v.start || date
    const ev = { title: v.title, start, end: multi && v.end ? v.end : start, color }
    // 시간은 넣었거나(또는 원래 있던 걸 지울 때)만 보낸다
    if (timed && v.time) Object.assign(ev, { time: v.time, endTime: v.endTime && v.endTime >= v.time ? v.endTime : '' })
    else if (init && 'time' in init) Object.assign(ev, { time: '', endTime: '' })
    onSave(ev)
    if (!init) { e.currentTarget.reset(); setMulti(false); setTimed(false) }
  }
  return (
    <form className="evform" onSubmit={submit}>
      <input className="inp" name="title" maxLength={40} defaultValue={init?.title || ''} placeholder="일정 (예: 병원 예약)" aria-label="일정 제목" autoFocus={!!init} required />
      <div className="row">
        <input className="inp" type="date" name="start" defaultValue={init?.start || date} key={'s' + date} aria-label="시작 날짜" style={{ width: 'auto' }} />
        {multi
          ? <>~<input className="inp" type="date" name="end" defaultValue={init?.end !== init?.start ? init?.end : ''} aria-label="끝 날짜" style={{ width: 'auto' }} />
              <button type="button" className="x" onClick={() => setMulti(false)}>하루만</button></>
          : <button type="button" className="btn sm" onClick={() => setMulti(true)}>+ 여러 날</button>}
        {timed
          ? <>
              <input className="inp" type="time" name="time" defaultValue={init?.time || ''} aria-label="시작 시간" style={{ width: 'auto' }} required />
              ~<input className="inp" type="time" name="endTime" defaultValue={init?.endTime || ''} aria-label="끝 시간 (선택)" style={{ width: 'auto' }} />
              <button type="button" className="x" onClick={() => setTimed(false)}>시간 빼기</button>
            </>
          : <button type="button" className="btn sm" onClick={() => setTimed(true)}>+ 시간</button>}
      </div>
      <div className="row">
        <span className="row" role="radiogroup" aria-label="색" style={{ gap: 4 }}>
          {COLORS.map(c => <button key={c} type="button" className={'swatch' + (color === c ? ' on' : '')} style={{ background: `var(--${c})` }} aria-pressed={color === c} aria-label={'색 ' + c} onClick={() => setColor(c)} />)}
        </span>
        <button className="btn pri sm">{init ? '저장' : '추가'}</button>
        {onCancel && <button type="button" className="btn sm" onClick={onCancel}>취소</button>}
      </div>
    </form>
  )
}
