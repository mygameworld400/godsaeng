import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD, today } from '../lib/date'
import { CatGlyph, ConfirmX, Help, formVals, withImage } from './common'

/* 운동 활동 페이지(추천 활동 page_kind = 'workout')의 아래쪽: 운동 캘린더.
   운동한 날 칸에는 이 활동 아이콘만 보이고, 날짜를 누르면 옆에 그날 일지(뭘 했는지·몇 분)가 열린다.
   기록은 gs_workouts. 홈 달력 칸 오른쪽 위에도 같은 아이콘이 작게 찍힌다. */

const md = d => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일 (${WD[toD(d).getDay()]})`

export default function WorkoutCal({ cat }) {
  const { S, act } = useStore()
  const [ym, setYm] = useState(today().slice(0, 7))
  const [sel, setSel] = useState(today())
  const [editing, setEditing] = useState(null)
  useEffect(() => { act.loadMonth(ym) }, [ym, act])

  const icon = withImage(cat, S.baseCats)
  const mine = Object.values(S.workouts).filter(w => w.catId === cat.id)
  const byDate = {}
  mine.forEach(w => { (byDate[w.date] ||= []).push(w) })
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay(), last = new Date(y, m, 0).getDate(), t = today()
  const move = n => { const d = new Date(y, m - 1 + n, 1); setYm(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')) }
  const monthMin = mine.filter(w => w.date.startsWith(ym)).reduce((a, w) => a + (w.minutes || 0), 0)
  const monthDays = Object.keys(byDate).filter(d => d.startsWith(ym)).length
  const day = byDate[sel] || []

  const add = e => {
    const v = formVals(e); if (!v.what) return
    act.addWorkout({ catId: cat.id, date: sel, what: v.what, minutes: Math.max(0, Math.min(1440, +v.minutes || 0)), memo: v.memo })
    e.currentTarget.reset()
  }

  return (
    <section className="sheet">
      <div className="row between">
        <h2><span>운동 캘린더</span><Help>날짜를 누르면 옆에 그날 운동 일지가 열려요. 운동한 날엔 아이콘이 찍히고, 홈 달력에도 작게 표시돼요.</Help></h2>
        <div className="row">
          <button className="btn sm" onClick={() => move(-1)} aria-label="지난달">‹</button>
          <b>{y}년 {m}월</b>
          <button className="btn sm" onClick={() => move(1)} aria-label="다음달">›</button>
        </div>
      </div>
      <p className="sub">이 달 {monthDays}일 · {monthMin}분 운동했어요</p>
      <div className="wk">
        <div className="wk-cal">
          {[...WD].map((w, i) => <span key={w} className={'wd' + (i === 0 ? ' sun' : '')}>{w}</span>)}
          {Array.from({ length: first }, (_, i) => <span key={'o' + i} />)}
          {Array.from({ length: last }, (_, i) => {
            const ds = ym + '-' + String(i + 1).padStart(2, '0'), has = !!byDate[ds]
            return (
              <button key={ds} className={'wk-d' + (ds === sel ? ' sel' : '') + (ds === t ? ' today' : '')} onClick={() => setSel(ds)} aria-label={ds + (has ? ' 운동함' : '')}>
                <span className="n">{i + 1}</span>
                {has && <CatGlyph cat={icon} size={26} />}
              </button>
            )
          })}
        </div>
        <div className="wk-log">
          <h3 className="evh">{md(sel)} 운동 일지</h3>
          {day.length ? day.map(w => editing === w.id ? (
            <form key={w.id} className="addf" onSubmit={e => { const v = formVals(e); if (v.what) act.updateWorkout(w.id, { what: v.what, minutes: +v.minutes || 0, memo: v.memo }); setEditing(null) }}>
              <input className="inp" name="what" defaultValue={w.what} maxLength={40} aria-label="운동" />
              <input className="inp" name="minutes" type="number" min={0} max={1440} defaultValue={w.minutes} style={{ flex: '0 0 76px' }} aria-label="분" />
              <input className="inp" name="memo" defaultValue={w.memo} maxLength={200} aria-label="메모" />
              <button className="btn pri sm">저장</button><button type="button" className="btn sm" onClick={() => setEditing(null)}>취소</button>
            </form>
          ) : (
            <div key={w.id} className="item">
              <span className="t"><b>{w.what}</b>{w.minutes ? ` · ${w.minutes}분` : ''}{w.memo && <small className="sub"> — {w.memo}</small>}</span>
              <button className="x" aria-label="수정" onClick={() => setEditing(w.id)}>✎</button>
              <ConfirmX onConfirm={() => act.delWorkout(w.id)} />
            </div>
          )) : <p className="empty" style={{ padding: '4px 0' }}>이 날은 기록이 없어요.</p>}
          <form className="addf" onSubmit={add}>
            <input className="inp" name="what" maxLength={40} placeholder="뭐 했나요? (예: 러닝)" aria-label="운동" />
            <input className="inp" name="minutes" type="number" min={0} max={1440} placeholder="분" style={{ flex: '0 0 76px' }} aria-label="몇 분" />
            <input className="inp" name="memo" maxLength={200} placeholder="메모 (선택)" aria-label="메모" />
            <button className="btn pri">기록</button>
          </form>
        </div>
      </div>
    </section>
  )
}
