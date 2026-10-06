import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { today, pretty } from '../lib/date'
import { stat, pc } from '../lib/stats'
import { MOODS, ConfirmX, CatSelect, Groups, PubToggle, formVals } from './common'

export default function Today() {
  const { S, act } = useStore()
  const [manageCats, setManageCats] = useState(false)
  const [filter, setFilter] = useState('')  // '' 전체 / 'none' 미분류 / 카테고리 id
  const me = S.me, d = act.myDay(S.date), isToday = S.date === today(), st = stat(me, d, true)
  const routines = me.routines.map(r => ({ ...r, _done: !!d.checks[r.id] }))
  const todos = d.todos.map(t => ({ ...t, _done: !!t.done }))

  const catFor = filter === 'none' ? '' : filter  // 새 항목 기본 카테고리
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

      <section className="sheet">
        <div className="row between">
          <h2><span>내 카테고리</span></h2>
          <button className="btn sm" onClick={() => setManageCats(!manageCats)}>{manageCats ? '완료' : '편집'}</button>
        </div>
        <p className="sub">카테고리를 누르면 그 카테고리의 루틴과 투두만 모아 볼 수 있어요.</p>
        <div className="chips">
          <span className={'chip' + (filter ? '' : ' on')}><button className="chipb" aria-pressed={!filter} onClick={() => setFilter('')}>전체</button>&nbsp;</span>
          {me.cats.map(c => (
            <span className={'chip' + (filter === c.id ? ' on' : '')} key={c.id}>
              <button className="chipb" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
                <span className="cdot" style={{ background: `var(--${c.color})` }} />{c.name}
              </button>
              {manageCats ? <ConfirmX onConfirm={() => { act.delCat(c.id); if (filter === c.id) setFilter('') }} /> : ' '}
            </span>
          ))}
          <span className={'chip' + (filter === 'none' ? ' on' : '')}><button className="chipb" aria-pressed={filter === 'none'} onClick={() => setFilter('none')}><span className="cdot" />미분류</button>&nbsp;</span>
          <form className="addf" style={{ flex: '1 1 180px' }} onSubmit={add(v => act.addCat(v.text))}>
            <input className="inp" name="text" maxLength={12} placeholder="새 카테고리 (예: 운동)" aria-label="새 카테고리 이름" />
            <button className="btn">만들기</button>
          </form>
        </div>
      </section>

      <div className="cols">
        <section className="sheet">
          <div className="row between"><h2><span>데일리 루틴</span></h2><span className="pill">달성 <b>{pc(st.rD, st.rT)}%</b></span></div>
          <p className="sub">매일 다시 나타나는 칸이에요. 공개를 켠 루틴만 미니홈피에 이름이 보이고, 나머지는 달성률에만 들어가요.</p>
          <Groups profile={me} items={routines} filter={filter} empty="루틴이 아직 없어요. 아래에 첫 루틴을 적어 보세요." row={r => (
            <div key={r.id} className={'item' + (r._done ? ' done' : '')}>
              <label><input type="checkbox" checked={r._done} onChange={e => act.toggleRoutine(r.id, e.target.checked)} /><span className="t">{r.text}</span></label>
              <PubToggle on={r.pub} onClick={() => act.togglePubRoutine(r.id)} />
              <ConfirmX onConfirm={() => act.delRoutine(r.id)} />
            </div>
          )} />
          <form className="addf" onSubmit={add(v => act.addRoutine(v.text, v.cat))}>
            <input className="inp" name="text" maxLength={40} placeholder="예: 스트레칭 10분" aria-label="새 루틴" />
            <CatSelect name="cat" cats={me.cats} value={catFor} />
            <button className="btn pri">추가</button>
          </form>
        </section>

        <section className="sheet">
          <div className="row between"><h2><span>{isToday ? '오늘의' : '이 날의'} 투두</span></h2><span className="pill">달성 <b>{pc(st.tD, st.tT)}%</b></span></div>
          <p className="sub">이 날짜에만 있는 할 일이에요. 공개를 켠 투두만 미니홈피에 이름이 보여요.</p>
          <Groups profile={me} items={todos} filter={filter} empty="아직 적은 투두가 없어요." row={t => (
            <div key={t.id} className={'item' + (t._done ? ' done' : '')}>
              <label><input type="checkbox" checked={t._done} onChange={e => act.toggleTodo(t.id, e.target.checked)} /><span className="t">{t.text}</span></label>
              <PubToggle on={t.pub} onClick={() => act.togglePubTodo(t.id)} />
              <button className="x" aria-label="삭제" onClick={() => act.delTodo(t.id)}>✕</button>
            </div>
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
          <h2><span>하루 마무리 일기</span></h2>
          <div className="moods" role="group" aria-label="오늘 기분">
            {MOODS.map(m => <button key={m} className="mood" aria-pressed={d.mood === m} onClick={() => act.setMood(m)}>{m}</button>)}
          </div>
        </div>
        <textarea className="diary" maxLength={2000} placeholder="오늘 하루는 어땠나요?" aria-label="일기"
          value={S.diary[S.date] || ''} onChange={e => act.setDiary(e.target.value)} />
        <label className="toggle"><input type="checkbox" checked={d.pub} onChange={e => act.setPub(e.target.checked)} /> 이 일기를 내 미니홈피에 공개하기</label>
        <p className="sub">{d.pub ? '친구들이 내 미니홈피에서 이 일기를 읽을 수 있어요.' : '체크하지 않으면 나만 볼 수 있어요.'}</p>
      </section>
    </div>
  )
}
