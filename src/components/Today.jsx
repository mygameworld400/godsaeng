import { useRef, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { today, pretty } from '../lib/date'
import { stat, pc } from '../lib/stats'
import { MOODS, ConfirmX, CatIcon, CatSelect, Groups, PubToggle, formVals, withImage, Help } from './common'
import Calendar from './Calendar'
import DiaryBook from './DiaryBook'

/* 루틴·투두 한 줄. ✎ 로 내용·활동 수정, ⋮⋮ 손잡이를 끌어 순서 바꾸기 (브라우저 기본 드래그, 라이브러리 없음). */
function ItemRow({ it, cats, editing, onEdit, onSave, onToggle, onPub, del, drag }) {
  if (editing) return (
    <form className="addf item-edit" onSubmit={e => { const v = formVals(e); if (v.text) onSave({ text: v.text, cat: v.cat }) }}>
      <input className="inp" name="text" maxLength={60} defaultValue={it.text} autoFocus aria-label="내용 수정" />
      <CatSelect name="cat" cats={cats} value={it.cat || ''} />
      <button className="btn pri sm">저장</button>
      <button type="button" className="btn sm" onClick={() => onEdit(null)}>취소</button>
    </form>
  )
  return (
    <div className={'item' + (it._done ? ' done' : '') + (drag.over === it.id ? ' drop' : '') + (drag.from === it.id ? ' dragging' : '')}
      draggable onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; drag.start(it.id) }} onDragEnd={drag.end}
      onDragOver={e => { e.preventDefault(); drag.hover(it.id) }} onDrop={e => { e.preventDefault(); drag.drop(it.id) }}>
      <span className="grip" aria-hidden="true" title="끌어서 순서 바꾸기">⋮⋮</span>
      <label><input type="checkbox" checked={it._done} onChange={e => onToggle(e.target.checked)} /><span className="t">{it.text}</span></label>
      <PubToggle on={it.pub} onClick={onPub} />
      <button className="x" aria-label="수정" onClick={() => onEdit(it.id)}>✎</button>
      {del}
    </div>
  )
}

/** 리스트 하나의 드래그 상태 */
function useDrag(move) {
  const [from, setFrom] = useState(null), [over, setOver] = useState(null), ref = useRef(null)
  return {
    from, over,
    start: id => { ref.current = id; setFrom(id) },
    hover: id => { if (ref.current && over !== id) setOver(id) },
    drop: id => { if (ref.current && ref.current !== id) move(ref.current, id); ref.current = null; setFrom(null); setOver(null) },
    end: () => { ref.current = null; setFrom(null); setOver(null) },
  }
}

export default function Today() {
  const { S, act } = useStore()
  const [filter, setFilter] = useState('')  // '' 전체 / 'none' 미분류 / 활동 id
  const [editing, setEditing] = useState(null)  // 수정 중인 루틴·투두 id
  const [book, setBook] = useState(false)       // 다이어리 책 팝업
  const rDrag = useDrag(act.moveRoutine), tDrag = useDrag(act.moveTodo)
  const me = S.me, d = act.myDay(S.date), isToday = S.date === today(), st = stat(me, d, true)
  const routines = me.routines.map(r => ({ ...r, _done: !!d.checks[r.id] }))
  const todos = d.todos.map(t => ({ ...t, _done: !!t.done }))

  const catFor = filter === 'none' ? '' : filter  // 새 항목 기본 활동
  const add = fn => e => { const v = formVals(e); if (v.text) { fn(v); e.currentTarget.reset() } }

  return (
    <div className="stack">
      <div className="row between">
        <div className="datenav">
          <button className="btn sm" aria-label="전날" onClick={() => act.setDate(-1)}>‹</button>
          <span className="date">{pretty(S.date)}</span>
          <button className="btn sm" aria-label="다음날" onClick={() => act.setDate(1)}>›</button>
          {!isToday && <button className="btn sm hl" onClick={() => act.setDate(0)}>오늘로</button>}
        </div>
        <div className="stats">
          <span className="pill">루틴 <b>{st.rD}/{st.rT}</b></span>
          <span className="pill">투두 <b>{st.tD}/{st.tT}</b></span>
          <span className="pill">달성 <b>{st.pct}%</b></span>
        </div>
      </div>

      <Calendar />

      <section className="sheet">
        <div className="row between">
          <h2><button className="linkh" onClick={() => { location.hash = 'cats' }}><span>내 활동</span> ›</button><Help>아이콘을 누르면 그 활동의 루틴과 투두만 모아 볼 수 있어요. 활동 추가·수정은 활동 탭에서 해요.</Help></h2>
        </div>
        <div className="icons">
          <CatIcon cat={{ icon: '✨' }} label="전체" on={!filter} onClick={() => setFilter('')} />
          {me.cats.map(c => <CatIcon key={c.id} cat={withImage(c, S.baseCats)} on={filter === c.id} onClick={() => setFilter(filter === c.id ? '' : c.id)} />)}
          <CatIcon cat={{ icon: '📦' }} label="미분류" on={filter === 'none'} onClick={() => setFilter(filter === 'none' ? '' : 'none')} />
        </div>
      </section>

      <div className="cols">
        <section className="sheet">
          <div className="row between"><h2><span>데일리 루틴</span><Help>매일 다시 나타나는 칸이에요. 공개를 켠 루틴만 미니홈피에 이름이 보이고, 나머지는 달성률에만 들어가요. ✎ 로 내용을 고치고, ⋮⋮ 를 끌어 순서를 바꿀 수 있어요.</Help></h2><span className="pill">달성 <b>{pc(st.rD, st.rT)}%</b></span></div>
          <Groups profile={me} items={routines} filter={filter} empty="루틴이 아직 없어요. 아래에 첫 루틴을 적어 보세요." row={r => (
            <ItemRow key={r.id} it={r} cats={me.cats} editing={editing === r.id} onEdit={setEditing} drag={rDrag}
              onSave={p => { act.editRoutine(r.id, p); setEditing(null) }} onToggle={on => act.toggleRoutine(r.id, on)}
              onPub={() => act.togglePubRoutine(r.id)} del={<ConfirmX onConfirm={() => act.delRoutine(r.id)} />} />
          )} />
          <form className="addf" onSubmit={add(v => act.addRoutine(v.text, v.cat))}>
            <input className="inp" name="text" maxLength={40} placeholder="예: 스트레칭 10분" aria-label="새 루틴" />
            <CatSelect name="cat" cats={me.cats} value={catFor} />
            <button className="btn pri">추가</button>
          </form>
        </section>

        <section className="sheet">
          <div className="row between"><h2><span>{isToday ? '오늘의' : '이 날의'} 투두</span><Help>이 날짜에만 있는 할 일이에요. 공개를 켠 투두만 미니홈피에 이름이 보여요. ✎ 로 내용을 고치고, ⋮⋮ 를 끌어 순서를 바꿀 수 있어요.</Help></h2><span className="pill">달성 <b>{pc(st.tD, st.tT)}%</b></span></div>
          <Groups profile={me} items={todos} filter={filter} empty="아직 적은 투두가 없어요." row={t => (
            <ItemRow key={t.id} it={t} cats={me.cats} editing={editing === t.id} onEdit={setEditing} drag={tDrag}
              onSave={p => { act.editTodo(t.id, p); setEditing(null) }} onToggle={on => act.toggleTodo(t.id, on)}
              onPub={() => act.togglePubTodo(t.id)} del={<button className="x" aria-label="삭제" onClick={() => act.delTodo(t.id)}>✕</button>} />
          )} />
          <form className="addf" onSubmit={add(v => act.addTodo(v.text, v.cat))}>
            <input className="inp" name="text" maxLength={60} placeholder="예: 과제 초안 보내기" aria-label="새 투두" />
            <CatSelect name="cat" cats={me.cats} value={catFor} />
            <button className="btn pri">추가</button>
          </form>
        </section>
      </div>

      <section className="sheet">
        <div className="row between">
          <h2><button className="linkh" onClick={() => setBook(true)} title="다이어리 펼치기"><span>다이어리</span></button>
            <Help>오늘 쓴 일기는 다이어리 책에 자동으로 들어가요. 제목을 누르면 다이어리가 펼쳐져요.</Help></h2>
          <div className="moods" role="group" aria-label="오늘 기분">
            {MOODS.map(m => <button key={m} className="mood" aria-pressed={d.mood === m} onClick={() => act.setMood(m)}>{m}</button>)}
          </div>
        </div>
        <textarea className="diary" maxLength={2000} placeholder="오늘 하루는 어땠나요?" aria-label="일기"
          value={S.diary[S.date] || ''} onChange={e => act.setDiary(e.target.value)} />
        <label className="toggle"><input type="checkbox" checked={d.pub} onChange={e => act.setPub(e.target.checked)} /> 이 일기를 내 미니홈피에 공개하기
          <Help>체크하면 친구들이 내 미니홈피에서 이 일기를 읽을 수 있어요. 체크하지 않으면 나만 볼 수 있어요.</Help></label>
      </section>
      {book && <DiaryBook onClose={() => setBook(false)} />}
    </div>
  )
}
