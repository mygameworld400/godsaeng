import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, addDays, toD, today, ymd } from '../lib/date'
import { Help, Modal, nickOf } from './common'

/* 미라클모닝 위클리 캘린더.
   - 월~일 한 주. 칸마다 참여자 얼굴 캐릭터(동그라미) + 아래 이름.
   - 오늘 칸: 기록 없는 사람도 기본 얼굴. 지난날: 기록한 사람만. 앞으로의 날: 비어 있음.
   - 내 칸(오늘·지난날)을 누르면 잔 시간·일어난 시간·결과(성공/애매/실패) 기록.
   진도: members[].progress = { goal: { bed, wake }, logs: { date: { bed, wake, result } } }
   얼굴: S.site.miracle = { default, ok, meh, fail } (없으면 이모지) */

export const RESULTS = [['ok', '성공', '😆'], ['meh', '애매', '😐'], ['fail', '실패', '😵']]
const FALLBACK = { default: '🙂', ok: '😆', meh: '😐', fail: '😵' }

export function Face({ kind, size = 40 }) {
  const { S } = useStore()
  const img = S.site?.miracle?.[kind]
  return <span className="face" style={{ width: size, height: size, fontSize: size * 0.62 }}>{img ? <img src={img} alt="" /> : FALLBACK[kind]}</span>
}

/** 목표 취침·기상 시간 정하기 (참여할 때, 그리고 나중에 수정) */
export function GoalForm({ goal, onSave, onClose }) {
  const [bed, setBed] = useState(goal?.bed || '23:00')
  const [wake, setWake] = useState(goal?.wake || '06:00')
  return (
    <Modal title="미라클모닝 목표" onClose={onClose}>
      <p className="sub">목표 취침 시간과 기상 시간을 먼저 정해요. 나중에 바꿀 수 있어요.</p>
      <div className="goal-row">
        <label>🌙 목표 취침<input className="inp" type="time" value={bed} onChange={e => setBed(e.target.value)} /></label>
        <label>☀️ 목표 기상<input className="inp" type="time" value={wake} onChange={e => setWake(e.target.value)} /></label>
      </div>
      <div className="row"><button className="btn pri" onClick={() => onSave({ bed, wake })}>저장하고 시작</button></div>
    </Modal>
  )
}

const mondayOf = d => { const x = toD(d), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return ymd(x) }

export default function MiracleBoard({ q }) {
  const { S, act } = useStore()
  const [week, setWeek] = useState(mondayOf(today()))
  const [log, setLog] = useState(null)       // 기록할 날짜
  const [goalEdit, setGoalEdit] = useState(false)
  const t = today()
  const mine = q.members.find(m => m.userId === S.uid)
  const goal = mine?.progress?.goal
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const save = patch => act.setQuestProgress(q, { ...mine.progress, ...patch })
  const myLog = log && (mine.progress.logs || {})[log]

  return (
    <div className="stack">
      <section className="sheet">
        <div className="row between">
          <h2><span>미라클모닝</span><Help>내 칸을 눌러 실제로 잔 시간·일어난 시간과 결과를 기록해요. 오늘은 모두의 얼굴이 보이고, 지난날은 기록한 사람만 보여요.</Help></h2>
          {goal && <span className="row">
            <span className="pill">🌙 {goal.bed} · ☀️ {goal.wake}</span>
            <button className="btn sm" onClick={() => setGoalEdit(true)}>목표 수정</button>
          </span>}
        </div>
        <div className="row between">
          <button className="btn sm" onClick={() => setWeek(addDays(week, -7))}>‹ 지난주</button>
          <b>{Number(week.slice(5, 7))}월 {Number(week.slice(8))}일 ~ {Number(days[6].slice(5, 7))}월 {Number(days[6].slice(8))}일</b>
          <span className="row">
            {week !== mondayOf(t) && <button className="btn sm" onClick={() => setWeek(mondayOf(t))}>이번 주</button>}
            <button className="btn sm" onClick={() => setWeek(addDays(week, 7))}>다음 주 ›</button>
          </span>
        </div>
        <div className="mweek">
          {days.map(ds => {
            const future = ds > t
            const people = future ? [] : q.members.map(m => {
              const l = m.progress?.logs?.[ds]
              if (l) return { m, kind: l.result || 'default', l }
              if (ds === t) return { m, kind: 'default', l: null }
              return null
            }).filter(Boolean)
            const mineHere = people.find(x => x.m.userId === S.uid)
            return (
              <div key={ds} className={'mday' + (ds === t ? ' today' : '') + (future ? ' future' : '')}>
                <div className="mday-h">{WD[toD(ds).getDay()]} <b>{Number(ds.slice(8))}</b></div>
                <div className="mfaces">
                  {people.map(({ m, kind, l }) => (
                    <button key={m.userId} className={'mface' + (m.userId === S.uid ? ' me' : '')} disabled={m.userId !== S.uid}
                      title={l ? `잠 ${l.bed || '-'} · 기상 ${l.wake || '-'}` : '아직 기록 전'} onClick={() => setLog(ds)}>
                      <Face kind={kind} />
                      <small>{nickOf(S, m.userId)}</small>
                    </button>
                  ))}
                  {!future && mine && !mineHere && <button className="mface add" onClick={() => setLog(ds)} title="기록하기"><span className="face">＋</span><small>기록</small></button>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {log && mine && (
        <Modal title={`${Number(log.slice(5, 7))}월 ${Number(log.slice(8))}일 기록`} onClose={() => setLog(null)}>
          <form className="addf col" onSubmit={e => {
            e.preventDefault()
            const f = new FormData(e.currentTarget), result = f.get('result')
            if (!result) return act.toast('성공·애매·실패 중 하나를 골라 주세요.')
            save({ logs: { ...(mine.progress.logs || {}), [log]: { bed: f.get('bed'), wake: f.get('wake'), result } } })
            setLog(null)
          }}>
            <div className="goal-row">
              <label>🌙 잔 시간<input className="inp" type="time" name="bed" defaultValue={myLog?.bed || goal?.bed || ''} /></label>
              <label>☀️ 일어난 시간<input className="inp" type="time" name="wake" defaultValue={myLog?.wake || goal?.wake || ''} /></label>
            </div>
            <div className="row" role="radiogroup" aria-label="결과">
              {RESULTS.map(([k, l]) => (
                <label key={k} className="mres"><input type="radio" name="result" value={k} defaultChecked={myLog?.result === k} /><Face kind={k} size={48} /><span>{l}</span></label>
              ))}
            </div>
            <div className="row">
              <button className="btn pri">저장</button>
              {myLog && <button type="button" className="btn sm warn" onClick={() => { const logs = { ...(mine.progress.logs || {}) }; delete logs[log]; save({ logs }); setLog(null) }}>기록 지우기</button>}
            </div>
          </form>
        </Modal>
      )}
      {goalEdit && mine && <GoalForm goal={goal} onClose={() => setGoalEdit(false)} onSave={g => { save({ goal: g }); setGoalEdit(false) }} />}
    </div>
  )
}
