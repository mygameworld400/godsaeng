import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD, today } from '../lib/date'
import { COLORS, ConfirmX, Help, formVals } from './common'

/* 가계부 활동 페이지 (추천 활동의 page_kind = 'ledger').
   위: 잔액(전체) + 이 달 수입·지출 + 지출 분류 도넛 그래프. 아래: 수입·지출 입력, 지출 분류 관리, 이 달 내역.
   기록은 gs_ledger (본인만), 지출 분류는 내 활동 세부(catDetails[catId].ledgerCats). 잔액·그래프는 저장하지 않고 매번 계산. */

const DEFAULT_CATS = [['식비', 'c1'], ['교통', 'c4'], ['쇼핑', 'c6'], ['생활', 'c3'], ['문화', 'c5'], ['기타', 'c2']]
const won = n => (n < 0 ? '-' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR') + '원'
const ymOf = d => d.slice(0, 7)

/** 도넛 그래프: [{ label, value, color }] */
function Donut({ parts, total }) {
  const r = 52, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="donut">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--line)" strokeWidth="18" />
        {total > 0 && parts.map(p => {
          const len = c * p.value / total, el = (
            <circle key={p.label} cx="64" cy="64" r={r} fill="none" stroke={`var(--${p.color})`} strokeWidth="18"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} transform="rotate(-90 64 64)" />
          )
          acc += len
          return el
        })}
      </svg>
      <div className="donut-v">{total > 0 ? <><small>이 달 지출</small>{won(total)}</> : <small>지출 없음</small>}</div>
    </div>
  )
}

export default function Ledger({ cat }) {
  const { S, act } = useStore()
  const [ym, setYm] = useState(ymOf(today()))
  const [editing, setEditing] = useState(null)
  const [manage, setManage] = useState(false)
  useEffect(() => { act.loadLedger(cat.id) }, [cat.id, act])

  const d = act.catDetail(cat.id)
  if (!d.ledgerCats) d.ledgerCats = DEFAULT_CATS.map(([name, color], i) => ({ id: 'k' + i, name, color }))
  const cats = d.ledgerCats
  const catOf = id => cats.find(k => k.id === id) || { id: '', name: '미분류', color: 'c2' }
  const all = S.ledger[cat.id] || []
  const balance = all.reduce((a, e) => a + (e.type === 'in' ? e.amount : -e.amount), 0)
  const month = all.filter(e => ymOf(e.date) === ym)
  const inSum = month.filter(e => e.type === 'in').reduce((a, e) => a + e.amount, 0)
  const outs = month.filter(e => e.type === 'out'), outSum = outs.reduce((a, e) => a + e.amount, 0)
  const parts = [...cats, { id: '', name: '미분류', color: 'c2' }].map(k => ({ label: k.name, color: k.color, value: outs.filter(e => (catOf(e.category).id || '') === k.id).reduce((a, e) => a + e.amount, 0) })).filter(p => p.value > 0)
  const [y, m] = ym.split('-').map(Number)
  const moveMonth = n => { const x = new Date(y, m - 1 + n, 1); setYm(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')) }

  const add = type => e => {
    const v = formVals(e), amount = Math.round(+String(v.amount).replace(/[^\d]/g, ''))
    if (!amount) return act.toast('금액을 넣어 주세요.')
    act.addLedger(cat.id, { type, amount, category: type === 'out' ? v.category : '', memo: v.memo, date: v.date || today() })
    e.currentTarget.reset()
  }
  const setCats = next => act.setCatDetail(cat.id, { ledgerCats: next })

  const byDate = {}
  month.forEach(e => { (byDate[e.date] ||= []).push(e) })

  return (
    <div className="stack">
      {S.ledgerError && <p className="note">가계부 저장 준비 중이에요. 지금 적는 내용은 새로고침하면 사라져요.</p>}
      <section className="sheet">
        <div className="ledger-top">
          <div className="ledger-sum">
            <span className="sub">잔액</span>
            <span className={'ledger-bal' + (balance < 0 ? ' neg' : '')}>{won(balance)}</span>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn sm" onClick={() => moveMonth(-1)} aria-label="지난달">‹</button>
              <b>{y}년 {m}월</b>
              <button className="btn sm" onClick={() => moveMonth(1)} aria-label="다음달">›</button>
            </div>
            <span className="ledger-in">수입 +{won(inSum)}</span>
            <span className="ledger-out">지출 -{won(outSum)}</span>
          </div>
          <div className="ledger-chart">
            <Donut parts={parts} total={outSum} />
            <div className="legend">{parts.map(p => <span key={p.label}><i style={{ background: `var(--${p.color})` }} />{p.label} {Math.round(p.value / outSum * 100)}%</span>)}</div>
          </div>
        </div>
      </section>

      <div className="cols">
        <form className="sheet" onSubmit={add('in')}>
          <h2><span>수입</span></h2>
          <div className="addf">
            <input className="inp" name="amount" inputMode="numeric" placeholder="금액 (예: 30000)" aria-label="수입 금액" />
            <input className="inp" name="date" type="date" defaultValue={today()} aria-label="날짜" style={{ flex: '0 0 auto', width: 'auto' }} />
          </div>
          <div className="addf">
            <input className="inp" name="memo" maxLength={100} placeholder="메모 (예: 용돈)" aria-label="메모" />
            <button className="btn pri">+ 수입</button>
          </div>
        </form>
        <form className="sheet" onSubmit={add('out')}>
          <h2><span>지출</span></h2>
          <div className="addf">
            <input className="inp" name="amount" inputMode="numeric" placeholder="금액 (예: 12000)" aria-label="지출 금액" />
            <select className="inp" name="category" aria-label="분류" defaultValue={cats[0]?.id || ''}>
              {cats.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              <option value="">미분류</option>
            </select>
            <input className="inp" name="date" type="date" defaultValue={today()} aria-label="날짜" style={{ flex: '0 0 auto', width: 'auto' }} />
          </div>
          <div className="addf">
            <input className="inp" name="memo" maxLength={100} placeholder="메모 (예: 점심)" aria-label="메모" />
            <button className="btn pri">- 지출</button>
          </div>
        </form>
      </div>

      <section className="sheet">
        <div className="row between">
          <h2><span>지출 분류</span><Help>지출을 나누는 분류예요. 이름·색을 바꾸거나 지울 수 있어요. 지운 분류의 지출은 '미분류'로 보여요.</Help></h2>
          <button className={'btn sm' + (manage ? ' hl' : '')} onClick={() => setManage(!manage)}>{manage ? '완료' : '편집'}</button>
        </div>
        {manage ? (
          <div className="edit-items">
            {cats.map((k, i) => (
              <div key={k.id} className="edit-item">
                <span className="row" style={{ gap: 3, flex: 'none' }}>
                  {COLORS.map(c => <button key={c} type="button" className={'swatch' + (k.color === c ? ' on' : '')} style={{ background: `var(--${c})` }} aria-label={'색 ' + c}
                    onClick={() => setCats(cats.map((x, j) => j === i ? { ...x, color: c } : x))} />)}
                </span>
                <input className="inp" value={k.name} maxLength={10} onChange={e => setCats(cats.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label="분류 이름" />
                <ConfirmX onConfirm={() => setCats(cats.filter((_, j) => j !== i))} />
              </div>
            ))}
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCats([...cats, { id: 'k' + Date.now().toString(36), name: '새 분류', color: COLORS[cats.length % COLORS.length] }])}>+ 분류 추가</button>
          </div>
        ) : (
          <div className="chips">{cats.map(k => <span key={k.id} className="chip"><span className="cdot" style={{ background: `var(--${k.color})` }} />{k.name}&nbsp;</span>)}</div>
        )}
      </section>

      <section className="sheet">
        <h2><span>{m}월 내역</span></h2>
        {month.length ? Object.keys(byDate).sort().reverse().map(date => (
          <div key={date} className="grp">
            <div className="grp-h">{Number(date.slice(5, 7))}월 {Number(date.slice(8))}일 ({WD[toD(date).getDay()]})
              <span className="n">{won(byDate[date].reduce((a, e) => a + (e.type === 'in' ? e.amount : -e.amount), 0))}</span></div>
            {byDate[date].map(e => editing === e.id ? (
              <form key={e.id} className="addf" onSubmit={ev => {
                const v = formVals(ev), amount = Math.round(+String(v.amount).replace(/[^\d]/g, ''))
                if (amount) act.updateLedger(cat.id, e.id, { amount, memo: v.memo, date: v.date || e.date, ...(e.type === 'out' ? { category: v.category } : {}) })
                setEditing(null)
              }}>
                <input className="inp" name="amount" defaultValue={e.amount} inputMode="numeric" aria-label="금액" />
                {e.type === 'out' && <select className="inp" name="category" defaultValue={e.category} aria-label="분류">
                  {cats.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}<option value="">미분류</option>
                </select>}
                <input className="inp" name="memo" defaultValue={e.memo} maxLength={100} aria-label="메모" />
                <input className="inp" name="date" type="date" defaultValue={e.date} aria-label="날짜" style={{ flex: '0 0 auto', width: 'auto' }} />
                <button className="btn pri sm">저장</button><button type="button" className="btn sm" onClick={() => setEditing(null)}>취소</button>
              </form>
            ) : (
              <div key={e.id} className="item">
                {e.type === 'out'
                  ? <span className="chip" style={{ flex: 'none' }}><span className="cdot" style={{ background: `var(--${catOf(e.category).color})` }} />{catOf(e.category).name}&nbsp;</span>
                  : <span className="pill" style={{ flex: 'none' }}>수입</span>}
                <span className="t">{e.memo}</span>
                <b className={e.type === 'in' ? 'ledger-in' : 'ledger-out'}>{e.type === 'in' ? '+' : '-'}{won(e.amount)}</b>
                <button className="x" aria-label="수정" onClick={() => setEditing(e.id)}>✎</button>
                <ConfirmX onConfirm={() => act.delLedger(cat.id, e.id)} />
              </div>
            ))}
          </div>
        )) : <p className="empty">이 달 내역이 없어요. 위에서 수입이나 지출을 적어 보세요.</p>}
      </section>
    </div>
  )
}
