import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, toD, today } from '../lib/date'
import { Modal } from './common'

/* 다이어리 책 (화면 가득, 바깥 상자 없음).
   표지(색·무늬·이름표 모양·글자)를 누르면 펼쳐지고, 좌우 두 장이 한 번에 보인다.
   오른쪽 장을 누르면 다음 장, 왼쪽 장을 누르면 이전 장 (글 쓰는 칸을 누를 때는 넘어가지 않음). 첫 펼침에서 왼쪽을 누르면 표지로.
   한 장 = 일기를 쓴 하루. 오늘 탭 '다이어리'에 쓴 글이 그대로 그 날짜 장이 되고, 책에서 고쳐도 같은 일기에 저장된다.
   표지 설정은 S.diaryCover (gs_private.diary_cover, 본인만). 좁은 화면(휴대폰)은 한 장씩. */

const COVER_COLORS = ['#E5534B', '#E08A1E', '#F2C744', '#2E9E6B', '#2F7FD6', '#7A5AE0', '#D14FA0', '#3B3B48', '#C9A27E', '#F4EFE6']
const PATTERNS = [['plain', '민무늬'], ['stripe', '줄무늬'], ['dot', '도트'], ['check', '체크'], ['grid', '모눈']]
const SHAPES = [['square', '네모'], ['circle', '동그라미'], ['heart', '하트']]
const DEFAULT = { color: '#2F7FD6', pattern: 'dot', shape: 'heart', title: 'MY DIARY', sub: '' }
const NEW = '__new__'
const NARROW = '(max-width: 700px)'

const pretty = d => `${d.slice(0, 4)}. ${Number(d.slice(5, 7))}. ${Number(d.slice(8))}. (${WD[toD(d).getDay()]})`

function useNarrow() {
  const [n, setN] = useState(() => matchMedia(NARROW).matches)
  useEffect(() => { const m = matchMedia(NARROW), f = () => setN(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f) }, [])
  return n
}

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
  const narrow = useNarrow(), per = narrow ? 1 : 2
  const [open, setOpen] = useState(false)  // 표지 / 펼침
  const [at, setAt] = useState(0)          // 펼친 첫 장 번호
  const [flip, setFlip] = useState('')
  const [deco, setDeco] = useState(false)
  const [newDate, setNewDate] = useState(today())
  const [extra, setExtra] = useState([])   // '새 장'으로 연 날짜 (아직 비어 있어도 장으로 보이게)
  useEffect(() => { act.loadAllDiaries() }, [act])

  const c = { ...DEFAULT, ...S.diaryCover }
  const dates = [...new Set([...Object.keys(S.diary).filter(d => (S.diary[d] || '').trim()), today(), ...extra])].sort()
  const pages = [...dates, NEW]
  const anim = dir => { setFlip(dir); setTimeout(() => setFlip(''), 420) }
  const next = () => { if (at + per < pages.length) { setAt(at + per); anim('next') } }
  const prev = () => { if (at === 0) { setOpen(false); return } setAt(Math.max(0, at - per)); anim('prev') }
  const openAt = date => {
    const all = [...new Set([...dates, date])].sort(), i = all.indexOf(date)
    setExtra(x => [...x, date]); setAt(i - (i % per)); anim('next')
  }
  // 글 쓰는 칸·버튼을 누르면 넘기지 않는다
  const turn = fn => e => { if (e.target.closest('textarea, input, button, label')) return; fn() }

  // 렌더 함수 (컴포넌트로 만들면 렌더마다 다시 마운트돼서 글을 쓰다 커서가 풀린다)
  const page = (p, side) => {
    const onClick = turn(side === 'left' ? prev : next)
    if (p === undefined) return <div key={side} className={'leaf ' + side + ' blank'} onClick={onClick} />
    if (p === NEW) return (
      <div key={side} className={'leaf ' + side + ' new'} onClick={onClick}>
        <div className="paper-head"><b>새 장</b></div>
        <p className="sub">일기를 쓸 날짜를 골라요.</p>
        <div className="row">
          <input className="inp" type="date" value={newDate} max={today()} onChange={e => setNewDate(e.target.value)} style={{ width: 'auto' }} aria-label="날짜" />
          <button className="btn pri sm" onClick={() => openAt(newDate)}>이 날짜로 쓰기</button>
        </div>
      </div>
    )
    return (
      <div key={side} className={'leaf ' + side} onClick={onClick}>
        <div className="paper-head">
          <b>{pretty(p)}</b>
          {S.days[p]?.mood && <span className="paper-mood">{S.days[p].mood}</span>}
          {p === today() && <span className="pill">오늘</span>}
        </div>
        <textarea className="paper-text" value={S.diary[p] || ''} placeholder="이 날의 이야기를 적어 보세요."
          onChange={e => act.setDiaryAt(p, e.target.value)} aria-label={pretty(p) + ' 일기'} />
        <span className="paper-no">{pages.indexOf(p) + 1}</span>
      </div>
    )
  }

  return (
    <Modal bare title="다이어리" onClose={onClose}>
      <div className="diary-stage">
        {!open ? (
          <div className="cover-wrap">
            <button className={'cover pat-' + c.pattern} style={{ '--cover': c.color }} onClick={() => { setOpen(true); setAt(0); anim('next') }} aria-label="다이어리 펼치기">
              <span className="cover-spine" />
              <Label c={c} />
              <span className="cover-hint">눌러서 펼치기 ›</span>
            </button>
            <button className={'btn sm' + (deco ? ' hl' : '')} onClick={() => setDeco(!deco)}>🎨 표지 꾸미기</button>
            {deco && (
              <div className="deco">
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
          </div>
        ) : (
          <div className={'spread' + (narrow ? ' one' : '') + (flip ? ' flip-' + flip : '')} style={{ '--cover': c.color }}>
            {page(pages[at], narrow ? 'right' : 'left')}
            {!narrow && page(pages[at + 1], 'right')}
          </div>
        )}
      </div>
    </Modal>
  )
}
