import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { pretty } from '../lib/date'
import { CAT_ICONS, COLORS, CatGlyph, CatIcon, ConfirmX, Help, Modal, catIcon, formVals, withImage } from './common'
import QuestPage, { PlanScreen, questCat } from './QuestPage'
import Ledger from './Ledger'
import Books from './Books'
import WorkoutCal from './WorkoutCal'
import KnowledgeScreen from './knowledge/KnowledgeScreen'

/* 활동 탭. 내 활동(담은 기본 + 직접 만든 개별)을 내가 정한 순서로 한 목록에 보여 준다.
   기본 활동(관리자가 정한 것)은 '추천 활동' 버튼을 눌러야 보이고, 눌러서 담는다.
   아이콘을 누르면 그 활동 페이지(시작 날짜 · 목표 · 투두리스트)로 간다.
   지금은 모든 활동이 같은 기본 구성이다. */

const goCat = id => { location.hash = id ? 'cats/' + id : 'cats' }

function IconPicker({ value, onChange }) {
  return (
    <div className="emo" role="group" aria-label="아이콘 고르기">
      {CAT_ICONS.map(e => <button key={e} type="button" className="mood" aria-pressed={value === e} onClick={() => onChange(e)}>{e}</button>)}
    </div>
  )
}

function CatList() {
  const { S, act } = useStore()
  const [adding, setAdding] = useState(false)
  const [recs, setRecs] = useState(false)      // 추천 활동 목록 펼침
  const [manage, setManage] = useState(false)  // 관리 모드: 삭제·순서 바꾸기
  const [icon, setIcon] = useState(CAT_ICONS[0])
  const [dragId, setDragId] = useState(null)
  const [pick, setPick] = useState(null)       // 하위 선택지 팝업을 띄운 추천 활동
  const mine = S.me.cats
  // 예전 계정은 base 표시가 없으니 이름이 같으면 추가된 것으로 본다
  const addedOf = (b, o) => o
    ? mine.find(c => c.base === b.id && c.opt === o.id)
    : mine.find(c => (c.base === b.id && !c.opt) || (!c.base && c.name === b.name))
  const anyAdded = b => b.options.length ? b.options.some(o => addedOf(b, o)) : addedOf(b)

  const create = e => {
    const v = formVals(e)
    if (!v.name) return
    const id = act.addCat(v.name, icon)
    setAdding(false)
    if (id) goCat(id)
  }

  return (
    <div className="stack">
      <section className="sheet">
        <div className="row between">
          <h2><span>내 활동</span>
            <Help>아이콘을 누르면 그 활동 페이지로 가요. 추천 활동에서 골라 담거나 새 활동을 직접 만들 수 있어요. 관리를 누르면 활동을 지우거나 순서를 바꿀 수 있어요.</Help></h2>
          <div className="row">
            <button className={'btn sm' + (recs ? ' hl' : '')} onClick={() => setRecs(!recs)} aria-expanded={recs}>⭐ 추천 활동</button>
            <Help>관리자가 준비한 활동이에요. 눌러서 내 활동에 담아요. ✓ 표시는 이미 담은 활동이에요.</Help>
            <button className={'btn sm' + (manage ? ' hl' : '')} onClick={() => { setManage(!manage); setAdding(false) }}>{manage ? '완료' : '관리'}</button>
            <Help>관리 모드에서 ✕ 로 활동을 지우고, 아이콘을 끌어서 놓거나 ◀ ▶ 로 순서를 바꿔요. 순서는 오늘 탭에도 똑같이 적용돼요.</Help>
          </div>
        </div>

        {recs && (
          <div className="recs">
            <div className="icons">
              {S.baseCats.length ? S.baseCats.map(b => {
                if (b.options.length) return (
                  <CatIcon key={b.id} cat={b} badge={anyAdded(b) ? '✓' : '…'} onClick={() => setPick(b)} />
                )
                const added = addedOf(b)
                return <CatIcon key={b.id} cat={b} badge={added ? '✓' : '+'} dim={!!added}
                  onClick={() => added ? goCat(added.id) : act.addBaseCat(b)} />
              }) : <p className="empty">아직 준비된 추천 활동이 없어요.</p>}
            </div>
          </div>
        )}

        <div className="icons">
          {mine.map((c, i) => manage ? (
            <div key={c.id} className={'mitem' + (dragId === c.id ? ' dragging' : '')} draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragId(c.id) }} onDragEnd={() => setDragId(null)}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (dragId) act.moveCat(dragId, c.id); setDragId(null) }}>
              <CatIcon cat={withImage(c, S.baseCats)} />
              <div className="mbtns">
                <button className="x" aria-label="앞으로" disabled={i === 0} onClick={() => act.shiftCat(c.id, -1)}>◀</button>
                <ConfirmX onConfirm={() => act.delCat(c.id)} />
                <button className="x" aria-label="뒤로" disabled={i === mine.length - 1} onClick={() => act.shiftCat(c.id, 1)}>▶</button>
              </div>
            </div>
          ) : <CatIcon key={c.id} cat={withImage(c, S.baseCats)} onClick={() => goCat(c.id)} />)}
          {!manage && <CatIcon cat={{ icon: '＋' }} label="새 활동" on={adding} onClick={() => setAdding(!adding)} />}
          {!mine.length && manage && <p className="empty">담긴 활동이 없어요.</p>}
        </div>
        {pick && (
          <Modal title={pick.name} onClose={() => setPick(null)}>
            <p className="sub">하나를 골라 내 활동에 담아요. 여러 개 담아도 돼요.</p>
            <div className="icons">
              {pick.options.map(o => {
                const added = addedOf(pick, o)
                const cat = { ...o, icon: o.icon || pick.icon, image: o.image || (o.icon ? '' : pick.image), color: pick.color }
                return <CatIcon key={o.id} cat={cat} badge={added ? '✓' : '+'} dim={!!added}
                  onClick={() => { if (added) { setPick(null); goCat(added.id) } else act.addBaseCat(pick, o) }} />
              })}
            </div>
          </Modal>
        )}
        {adding && !manage && (
          <form className="addf col" onSubmit={create}>
            <label>이름<input className="inp" name="name" maxLength={12} placeholder="예: 다이어트" autoFocus /></label>
            <IconPicker value={icon} onChange={setIcon} />
            <div className="row"><button className="btn pri">만들기</button><button type="button" className="btn" onClick={() => setAdding(false)}>취소</button></div>
          </form>
        )}
      </section>

      {S.quests.length > 0 && (
        <section className="sheet">
          <h2><span>챌린지</span><Help>여러 사람이 같은 플랜을 함께 하는 챌린지예요. 누르면 참여한 사람과 설명이 보이고, 참여하면 그 활동이 내 활동에 담겨요.</Help></h2>
          <div className="quests">
            {S.quests.map(q => {
              const cat = questCat(q, S.baseCats), joined = q.members.some(m => m.userId === S.uid)
              return (
                <button key={q.id} className={'quest' + (joined ? ' on' : '')} onClick={() => goCat('q:' + q.id)}>
                  <CatGlyph cat={cat} size={34} />
                  <span className="quest-t"><small>{cat.name}</small><b>{q.title}</b></span>
                  <span className="pill">{q.members.length}명{joined ? ' · 참여 중' : ''}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function CatPage({ id }) {
  const { S, act } = useStore()
  const [edit, setEdit] = useState(false)
  const [editTodo, setEditTodo] = useState(null)  // 수정 중인 투두 id
  const [helper, setHelper] = useState(false)   // 개인공부 도우미 (준비 중)
  const cat = S.me.cats.find(c => c.id === id)
  const [icon, setIcon] = useState(catIcon(cat))
  if (!cat) return (
    <div className="sheet">
      <p className="empty">이 활동을 찾지 못했어요. 지워졌을 수 있어요.</p>
      <div className="row"><button className="btn" onClick={() => goCat()}>‹ 활동 목록</button></div>
    </div>
  )
  const linked = S.quests.filter(q => q.baseId === cat.base && (q.optionId || null) === (cat.opt || null))
  const d = act.catDetail(id), done = d.todos.filter(t => t.done).length
  // 추천 활동이 '가계부' 페이지면 기본 구성(시작 날짜·목표·투두) 대신 가계부
  const baseCat = S.baseCats.find(b => b.id === cat.base), kind = baseCat?.kind
  const isLedger = kind === 'ledger'
  const isBase = !!cat.base  // 기본 활동은 이름·아이콘을 관리자가 정한다 (빼기만 가능)
  const routines = S.me.routines.filter(r => r.cat === id)
  // '지식' 페이지는 기본 구성(목표·투두) 없이 전용 전체 화면
  if (kind === 'knowledge') return <KnowledgeScreen back={() => goCat()} />

  const saveInfo = e => {
    const v = formVals(e)
    if (!v.name) return
    act.updateCat(id, { name: v.name, icon, color: v.color || cat.color })
    setEdit(false)
  }
  const addTodo = e => { const v = formVals(e); if (v.text) { act.addCatTodo(id, v.text); e.currentTarget.reset() } }

  return (
    <div className="stack">
      <div className="row"><button className="btn sm" onClick={() => goCat()}>‹ 활동 목록</button></div>

      {linked.length > 0 && (
        <div className="cat-modes">
          {linked.map(q => {
            const joined = q.members.some(m => m.userId === S.uid)
            return (
              <div key={q.id} className="mode-btn mode-box" role="button" tabIndex={0} onClick={() => goCat('q:' + q.id)} onKeyDown={e => { if (e.key === 'Enter') goCat('q:' + q.id) }}>
                <span>🏆 <b>챌린지</b></span>
                <small>{q.title}{joined ? ' · 참여 중' : ''}</small>
                {joined && <button className="btn pri sm" onClick={e => { e.stopPropagation(); goCat('plan:' + q.id) }}>{q.kind === 'miracle' ? '📅 위클리 열기' : '📖 플랜 열기'}</button>}
              </div>
            )
          })}
          {kind !== 'miracle' && <button className="mode-btn" onClick={() => setHelper(true)}>📘 <b>개인공부 도우미</b><small>나만의 공부 계획</small></button>}
        </div>
      )}
      {helper && <Modal title="개인공부 도우미" onClose={() => setHelper(false)}><p className="empty">준비 중이에요. 곧 만나요!</p></Modal>}

      <section className="sheet">
        <div className="hero">
          <CatGlyph cat={withImage(cat, S.baseCats)} size={72} />
          <div className="grow">
            <p className="nick">{cat.name}{baseCat?.subtitle && <small className="nick-sub"> · {baseCat.subtitle}</small>}</p>
            <p className="sub">{d.start ? `${pretty(d.start)} 시작` : '시작 날짜 미정'}</p>
          </div>
          {isBase
            ? <ConfirmX onConfirm={() => { act.delCat(id); goCat() }} label="내 활동에서 빼기" className="btn sm" />
            : <div className="row">
                <button className="btn sm" onClick={() => { setEdit(!edit); setIcon(catIcon(cat)) }}>{edit ? '닫기' : '수정'}</button>
                <ConfirmX onConfirm={() => { act.delCat(id); goCat() }} label="삭제" className="btn sm warn" />
              </div>}
          <Help>{isBase
            ? '관리자가 준비한 활동이라 이름과 아이콘은 바꿀 수 없어요. 빼도 활동 목록에서 다시 추가할 수 있어요. 빼면 이 활동의 목표·투두는 지워지고, 루틴과 투두는 미분류로 옮겨져요.'
            : '직접 만든 활동이라 이름·아이콘·색을 마음대로 바꿀 수 있어요. 삭제하면 목표·투두는 지워지고, 루틴과 투두는 미분류로 옮겨져요.'}</Help>
        </div>
        {edit && !isBase && (
          <form className="addf col" onSubmit={saveInfo}>
            <label>이름<input className="inp" name="name" maxLength={12} defaultValue={cat.name} required /></label>
            <IconPicker value={icon} onChange={setIcon} />
            <div className="row" role="radiogroup" aria-label="색">
              {COLORS.map(c => (
                <label key={c} className="toggle"><input type="radio" name="color" value={c} defaultChecked={cat.color === c} />
                  <span className="cdot" style={{ background: `var(--${c})`, width: 16, height: 16 }} /></label>
              ))}
            </div>
            <div className="row"><button className="btn pri">저장</button></div>
          </form>
        )}
      </section>

      {kind === 'miracle' ? null : isLedger ? <Ledger cat={cat} /> : <>
      <div className="cols">
        <section className="sheet">
          <h2><span>시작 날짜</span></h2>
          <input className="inp" type="date" value={d.start || ''} onChange={e => act.setCatDetail(id, { start: e.target.value })} aria-label="시작 날짜" />
          <h2><span>목표</span></h2>
          <textarea className="inp" rows={3} maxLength={200} value={d.goal || ''} placeholder="예: 3개월 동안 주 3회 운동하기"
            onChange={e => act.setCatDetail(id, { goal: e.target.value })} aria-label="목표" />
        </section>

        <section className="sheet">
          <div className="row between"><h2><span>투두리스트</span><Help>날짜와 상관없이 이 활동에서 해야 할 일이에요.</Help></h2><span className="pill"><b>{done}/{d.todos.length}</b> 완료</span></div>
          {d.todos.length ? d.todos.map(t => editTodo === t.id ? (
            <form key={t.id} className="addf" onSubmit={e => { const v = formVals(e); if (v.text) act.editCatTodo(id, t.id, v.text); setEditTodo(null) }}>
              <input className="inp" name="text" maxLength={60} defaultValue={t.text} autoFocus aria-label="할 일 수정" />
              <button className="btn pri sm">저장</button><button type="button" className="btn sm" onClick={() => setEditTodo(null)}>취소</button>
            </form>
          ) : (
            <div key={t.id} className={'item' + (t.done ? ' done' : '')}>
              <label><input type="checkbox" checked={t.done} onChange={() => act.toggleCatTodo(id, t.id)} /><span className="t">{t.text}</span></label>
              <button className="x" aria-label="수정" onClick={() => setEditTodo(t.id)}>✎</button>
              <button className="x" aria-label="삭제" onClick={() => act.delCatTodo(id, t.id)}>✕</button>
            </div>
          )) : <p className="empty">아직 할 일이 없어요.</p>}
          <form className="addf" onSubmit={addTodo}>
            <input className="inp" name="text" maxLength={60} placeholder="예: 운동화 사기" aria-label="새 할 일" />
            <button className="btn pri">추가</button>
          </form>
        </section>
      </div>

      {routines.length > 0 && (
        <section className="sheet">
          <h2><span>이 활동의 데일리 루틴</span></h2>
          {routines.map(r => <div key={r.id} className="item ro"><span className="mark">↻</span><span className="t">{r.text}</span></div>)}
        </section>
      )}
        {(kind === 'reading' || kind === 'media') && <Books cat={cat} kind={kind} />}
        {kind === 'workout' && <WorkoutCal cat={cat} />}
      </>}
    </div>
  )
}

export default function Categories({ catId }) {
  if (catId?.startsWith('plan:')) return <PlanScreen key={catId} id={catId.slice(5)} back={() => history.length > 1 ? history.back() : goCat()} />
  if (catId?.startsWith('q:')) return <QuestPage key={catId} id={catId.slice(2)} back={() => history.length > 1 ? history.back() : goCat()} />
  return catId ? <CatPage key={catId} id={catId} /> : <CatList />
}
