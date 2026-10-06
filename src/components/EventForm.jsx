import { useState } from 'react'
import { COLORS, formVals } from './common'

/** 일정 추가·수정 폼. end 를 비우면 하루짜리, '+ 여러 날'로 연속 일정 */
export default function EventForm({ init, date, onSave, onCancel }) {
  const [color, setColor] = useState(init?.color || 'c4')
  const [multi, setMulti] = useState(!!init && !!init.start && init.end !== init.start)
  const [noDate, setNoDate] = useState(!!init && !init.start)  // 날짜 없는 일정
  const submit = e => {
    const v = formVals(e)
    if (!v.title) return
    onSave(noDate ? { title: v.title, start: null, end: null, color } : { title: v.title, start: v.start || date, end: multi && v.end ? v.end : v.start || date, color })
    if (!init) { e.currentTarget.reset(); setMulti(false); setNoDate(false) }
  }
  return (
    <form className="evform" onSubmit={submit}>
      <input className="inp" name="title" maxLength={40} defaultValue={init?.title || ''} placeholder="일정 (예: 휴가)" aria-label="일정 제목" autoFocus={!!init} required />
      <div className="row">
        <label className="toggle"><input type="checkbox" checked={noDate} onChange={e => setNoDate(e.target.checked)} /> 날짜 없음</label>
        {!noDate && <input className="inp" type="date" name="start" defaultValue={init?.start || date} key={'s' + date} aria-label="시작 날짜" style={{ width: 'auto' }} />}
        {noDate ? null : multi
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
