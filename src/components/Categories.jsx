import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { pretty } from '../lib/date'
import { CAT_ICONS, COLORS, CatGlyph, CatIcon, ConfirmX, Help, catIcon, formVals, withImage } from './common'

/* 활동 탭. 기본(관리자가 정해 둔 것, 골라서 추가)과 개별(직접 만든 것)은 개념상 구분일 뿐
   화면에서는 한 목록으로 보여 준다.
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
  const [icon, setIcon] = useState(CAT_ICONS[0])
  const mine = S.me.cats
  // 예전 계정은 base 표시가 없으니 이름이 같으면 추가된 것으로 본다
  const addedOf = b => mine.find(c => c.base === b.id || (!c.base && c.name === b.name))
  const custom = mine.filter(c => !S.baseCats.some(b => addedOf(b)?.id === c.id))

  const create = e => {
    const v = formVals(e)
    if (!v.name) return
    const id = act.addCat(v.name, icon)
    setAdding(false)
    if (id) goCat(id)
  }

  return (
    <section className="sheet">
      <h2><span>활동</span><Help>아이콘을 누르면 그 활동 페이지로 가요. 흐린 아이콘은 아직 추가하지 않은 활동이에요. 누르면 내 활동으로 추가돼요.</Help></h2>
      <div className="icons">
        {S.baseCats.map(b => {
          const added = addedOf(b)
          return added
            ? <CatIcon key={b.id} cat={withImage(added, S.baseCats)} onClick={() => goCat(added.id)} />
            : <CatIcon key={b.id} cat={b} dim badge="+" onClick={() => act.addBaseCat(b)} />
        })}
        {custom.map(c => <CatIcon key={c.id} cat={c} onClick={() => goCat(c.id)} />)}
        <CatIcon cat={{ icon: '＋' }} label="새 활동" on={adding} onClick={() => setAdding(!adding)} />
      </div>
      {adding && (
        <form className="addf col" onSubmit={create}>
          <label>이름<input className="inp" name="name" maxLength={12} placeholder="예: 다이어트" autoFocus /></label>
          <IconPicker value={icon} onChange={setIcon} />
          <div className="row"><button className="btn pri">만들기</button><button type="button" className="btn" onClick={() => setAdding(false)}>취소</button></div>
        </form>
      )}
    </section>
  )
}

function CatPage({ id }) {
  const { S, act } = useStore()
  const [edit, setEdit] = useState(false)
  const [editTodo, setEditTodo] = useState(null)  // 수정 중인 투두 id
  const cat = S.me.cats.find(c => c.id === id)
  const [icon, setIcon] = useState(catIcon(cat))
  if (!cat) return (
    <div className="sheet">
      <p className="empty">이 활동을 찾지 못했어요. 지워졌을 수 있어요.</p>
      <div className="row"><button className="btn" onClick={() => goCat()}>‹ 활동 목록</button></div>
    </div>
  )
  const d = act.catDetail(id), done = d.todos.filter(t => t.done).length
  const isBase = !!cat.base  // 기본 활동은 이름·아이콘을 관리자가 정한다 (빼기만 가능)
  const routines = S.me.routines.filter(r => r.cat === id)

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

      <section className="sheet">
        <div className="hero">
          <CatGlyph cat={withImage(cat, S.baseCats)} size={72} />
          <div className="grow">
            <p className="nick">{cat.name}</p>
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
    </div>
  )
}

export default function Categories({ catId }) {
  return catId ? <CatPage key={catId} id={catId} /> : <CatList />
}
