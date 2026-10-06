import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD, today } from '../lib/date'
import { Modal } from './common'

/* 다이어리 책 팝업.
   표지(색·무늬·이름표 모양·글자)를 꾸미고, 누르면 한 장씩 넘어간다. 한 장 = 일기를 쓴 하루.
   오늘 탭 '다이어리'에 쓴 글이 그대로 이 책의 그 날짜 장이 되고, 책에서 고쳐도 똑같이 저장된다.
   표지 설정은 S.diaryCover (gs_private.diary_cover, 본인만). */

const COVER_COLORS = ['#E5534B', '#E08A1E', '#F2C744', '#2E9E6B', '#2F7FD6', '#7A5AE0', '#D14FA0', '#3B3B48', '#C9A27E', '#F4EFE6']
const PATTERNS = [['plain', '민무늬'], ['stripe', '줄무늬'], ['dot', '도트'], ['check', '체크'], ['grid', '모눈']]
const SHAPES = [['square', '네모'], ['circle', '동그라미'], ['heart', '하트']]
const DEFAULT = { color: '#2F7FD6', pattern: 'dot', shape: 'heart', title: 'MY DIARY', sub: '' }

const pretty = d => `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8))}. (${WD[toD(d).getDay()]})`

function Label({ c }) {
  return (
    <div className={'cover-label shape-' + c.shape}>
      {c.shape === 'heart' && (
        <svg viewBox="0 0 100 90" aria-hidden="true"><path d="M50 86 C20 62 2 46 2 26 C2 12 13 2 27 2 C37 2 45 8 50 16 C55 8 63 2 73 2 C87 2 98 12 98 26 C98 46 80 62 50 86 Z" /></svg>
      )}
      <span className="cover-title">{c.title || ' '}</span>
      {c.sub && <span className="cover-sub">{c.sub}</span>}
    </div>
  )
}

export default function DiaryBook({ onClose }) {
  const { S, act } = useStore()
  const [page, setPage] = useState(0)      // 0 = 표지, 1.. = 일기 장, 마지막 = 새 장
  const [flip, setFlip] = useState('')     // 넘기는 방향 애니메이션
  const [deco, setDeco] = useState(false)  // 표지 꾸미기 패널
  const [newDate, setNewDate] = useState(today())
  const [extra, setExtra] = useState([])   // 방금 '새 장'으로 연 날짜 (아직 비어 있어도 장으로 보이게)
  useEffect(() => { act.loadAllDiaries() }, [act])

  const c = { ...DEFAULT, ...S.diaryCover }
  const canSaveCover = S.diaryCover !== undefined || S.local
  const dates = [...new Set([...Object.keys(S.diary).filter(d => (S.diary[d] || '').trim()), today(), ...extra])].sort()
  const last = dates.length + 1  // 새 장
  const go = n => {
    if (n < 0 || n > last) return
    setFlip(n > page ? 'next' : 'prev'); setPage(n)
    setTimeout(() => setFlip(''), 450)
  }
  const date = page >= 1 && page <= dates.length ? dates[page - 1] : null
  const mood = date ? S.days[date]?.mood : ''

  return (
    <Modal title="다이어리" onClose={onClose}>
      <div className={'book' + (flip ? ' flip-' + flip : '')}>
        {page === 0 ? (
          <button className={'cover pat-' + c.pattern} style={{ '--cover': c.color }} onClick={() => go(1)} aria-label="다이어리 펼치기">
            <span className="cover-spine" />
            <Label c={c} />
            <span className="cover-hint">눌러서 펼치기 ›</span>
          </button>
        ) : date ? (
          <div className="paper">
            <div className="paper-head">
              <b>{pretty(date)}</b>
              {mood && <span className="paper-mood">{mood}</span>}
              {date === today() && <span className="pill">오늘</span>}
            </div>
            <textarea className="paper-text" value={S.diary[date] || ''} placeholder="이 날의 이야기를 적어 보세요."
              onChange={e => act.setDiaryAt(date, e.target.value)} aria-label={pretty(date) + ' 일기'} />
            <span className="paper-no">{page} / {dates.length}</span>
          </div>
        ) : (
          <div className="paper new">
            <div className="paper-head"><b>새 장</b></div>
            <p className="sub">일기를 쓸 날짜를 고르면 그 날짜 장이 생겨요.</p>
            <div className="row">
              <input className="inp" type="date" value={newDate} max={today()} onChange={e => setNewDate(e.target.value)} style={{ width: 'auto' }} aria-label="날짜" />
              <button className="btn pri sm" onClick={() => {
                setExtra([...extra, newDate])
                const all = [...new Set([...dates, newDate])].sort()
                setFlip('next'); setPage(all.indexOf(newDate) + 1); setTimeout(() => setFlip(''), 450)
              }}>이 날짜로 쓰기</button>
            </div>
          </div>
        )}
      </div>

      <div className="row between">
        <button className="btn sm" disabled={page === 0} onClick={() => go(page - 1)}>‹ 앞장</button>
        <span className="row">
          {page !== 0 && <button className="btn sm" onClick={() => go(0)}>표지</button>}
          {page === 0 && <button className={'btn sm' + (deco ? ' hl' : '')} onClick={() => setDeco(!deco)}>🎨 표지 꾸미기</button>}
        </span>
        <button className="btn sm" disabled={page === last} onClick={() => go(page + 1)}>뒷장 ›</button>
      </div>

      {page === 0 && deco && (
        <div className="deco">
          {!canSaveCover && <p className="sub">표지 저장 준비 중이에요. 꾸민 내용은 지금 화면에만 보여요.</p>}
          <div className="row" role="radiogroup" aria-label="표지 색">
            {COVER_COLORS.map(col => <button key={col} className={'swatch big' + (c.color === col ? ' on' : '')} style={{ background: col }} aria-label={col} onClick={() => act.setDiaryCover({ color: col })} />)}
            <input type="color" value={c.color} onChange={e => act.setDiaryCover({ color: e.target.value })} aria-label="다른 색" />
          </div>
          <div className="row"><span className="sub">무늬</span>{PATTERNS.map(([k, l]) => <button key={k} className={'btn sm' + (c.pattern === k ? ' hl' : '')} onClick={() => act.setDiaryCover({ pattern: k })}>{l}</button>)}</div>
          <div className="row"><span className="sub">이름표</span>{SHAPES.map(([k, l]) => <button key={k} className={'btn sm' + (c.shape === k ? ' hl' : '')} onClick={() => act.setDiaryCover({ shape: k })}>{l}</button>)}</div>
          <div className="row">
            <input className="inp" value={c.title} maxLength={20} onChange={e => act.setDiaryCover({ title: e.target.value })} placeholder="표지 제목" aria-label="표지 제목" />
            <input className="inp" value={c.sub} maxLength={30} onChange={e => act.setDiaryCover({ sub: e.target.value })} placeholder="작은 글씨 (예: 2026 갓생 기록)" aria-label="작은 글씨" />
          </div>
        </div>
      )}
    </Modal>
  )
}
