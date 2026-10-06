import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { WD, today, addDays, toD, pretty } from '../lib/date'
import { stat, streak, pc } from '../lib/stats'
import { AvaPicker, ConfirmX, Groups, Ring, avaOf, nickOf, formVals } from './common'

export default function Hompy() {
  const { S, act } = useStore()
  const [edit, setEdit] = useState(false)
  const [emoji, setEmoji] = useState(S.me.emoji)
  const [open, setOpen] = useState({ r: false, t: false })
  const id = S.view || S.uid, mine = id === S.uid, p = mine ? S.me : S.people[id]
  const who = [S.uid, ...S.me.friends.filter(f => S.people[f])]

  const switcher = (
    <div className="chips" role="group" aria-label="미니홈피 고르기">
      {who.map(w => (
        <button key={w} className={'chip' + (w === id ? ' on' : '')} onClick={() => act.view(w)}>
          {avaOf(S, w)} {nickOf(S, w)}{w === S.uid ? ' (나)' : ''}&nbsp;
        </button>
      ))}
    </div>
  )
  if (!p) return <div className="stack">{switcher}<div className="sheet"><p className="empty">이 친구의 미니홈피를 찾지 못했어요.</p></div></div>

  const days = mine ? S.days : S.vdays, t = today(), d = days[t], st = stat(p, d, mine), sk = streak(days, p, mine)
  const week = []
  for (let i = 6; i >= 0; i--) { const dt = addDays(t, -i); week.push({ dt, s: i === 0 ? st : stat(p, days[dt], false) }) }
  // 친구 것은 원래 공개 항목만 내려온다. 내 것도 미니홈피에서는 공개 항목만 보여 준다.
  const routines = (p.routines || []).filter(r => r.pub).map(r => ({ ...r, _done: !!d?.checks?.[r.id] }))
  const todos = (d?.todos || []).filter(x => x.pub).map(x => ({ ...x, _done: !!x.done }))
  const pubs = Object.values(days).filter(x => x?.pub && x.diary).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 3)
  const isFriend = S.me.friends.includes(id)

  const saveProfile = e => {
    const v = formVals(e)
    if (!v.nick) return
    act.saveProfile({ nick: v.nick, bio: v.bio, emoji })
    setEdit(false)
  }
  const ro = i => (
    <div key={i.id} className={'item ro' + (i._done ? ' done' : '')}>
      <span className="mark">{i._done ? '✓' : ''}</span><span className="t">{i.text}</span>
    </div>
  )
  // 렌더 함수로 쓴다 (컴포넌트로 만들면 매 렌더마다 새 타입이라 다시 마운트됨)
  const acc = ({ k, label, done, tot, items }) => (
    <section className="sheet">
      <button className="acc" aria-expanded={open[k]} onClick={() => setOpen({ ...open, [k]: !open[k] })}>
        <span className="row between"><span className="sub">오늘 {label} 달성률</span><span className="pill"><b>{done}/{tot}</b> 완료</span></span>
        <span className="big">{pc(done, tot)}%</span>
        <span className="meter" aria-hidden="true"><i style={{ width: pc(done, tot) + '%' }} /></span>
        <span className="more">{open[k] ? '접기 ▴' : '눌러서 자세히 보기 ▾'}</span>
      </button>
      {open[k] && <>
        <p className="sub">공개로 설정한 {label}만 보여요. (공개 {items.length}개 / 전체 {tot}개)</p>
        <Groups profile={p} items={items} row={ro}
          empty={mine ? `공개한 ${label}가 없어요. 오늘 탭에서 항목 옆의 비공개를 눌러 공개로 바꿀 수 있어요.` : `공개한 ${label}가 없어요.`} />
      </>}
    </section>
  )
  const cheer = e => { const v = formVals(e); if (v.text) { act.addCheer(v.text); e.currentTarget.reset() } }

  return (
    <div className="stack">
      {switcher}
      <section className="sheet">
        <div className="hero">
          <div className="ava">{p.emoji || '🙂'}</div>
          <div className="grow">
            <p className="nick">{p.nick}</p>
            <p className="bio">{p.bio || (mine ? '한 줄 소개를 적어 보세요.' : '한 줄 소개가 아직 없어요.')}</p>
            <div className="stats" style={{ marginTop: 8 }}>
              <span className="pill">연속 <b>{sk}일</b></span>
              {d?.mood && <span className="pill">기분 {d.mood}</span>}
            </div>
          </div>
          <Ring pct={st.pct} label="오늘 달성" />
        </div>
        <div className="row">
          {mine
            ? <button className="btn sm" onClick={() => { setEdit(!edit); setEmoji(S.me.emoji) }}>{edit ? '닫기' : '프로필 수정'}</button>
            : isFriend ? <span className="pill">내 친구</span>
              : <button className="btn sm pri" onClick={() => act.addFriend(id)}>친구 추가</button>}
        </div>
        {mine && edit && (
          <form className="addf col" onSubmit={saveProfile}>
            <label htmlFor="pf-nick">닉네임</label>
            <input className="inp" id="pf-nick" name="nick" maxLength={16} defaultValue={p.nick} required />
            {p.handle && <p className="sub">로그인 아이디는 가입할 때 정한 「{p.handle}」 그대로예요. 여기서 바꾸는 건 화면에 보이는 이름이에요.</p>}
            <label htmlFor="pf-bio">한 줄 소개</label>
            <input className="inp" id="pf-bio" name="bio" maxLength={60} defaultValue={p.bio || ''} placeholder="예: 올해는 진짜 아침형 인간" />
            <AvaPicker value={emoji} onChange={setEmoji} />
            <div className="row"><button className="btn pri">저장</button></div>
          </form>
        )}
      </section>

      <div className="cols">
        {acc({ k: 'r', label: '루틴', done: st.rD, tot: st.rT, items: routines })}
        {acc({ k: 't', label: '투두', done: st.tD, tot: st.tT, items: todos })}
      </div>

      <div className="cols">
        <section className="sheet">
          <h2><span>최근 7일 달성률</span></h2>
          <div className="week">
            {week.map((w, i) => (
              <div key={w.dt} className={'bar' + (w.s.pct ? '' : ' t0') + (i === 6 ? ' now' : '')} title={`${w.dt} ${w.s.pct}%`}>
                <span>{w.s.pct}%</span><i style={{ height: Math.max(3, w.s.pct * 0.7) + '%' }} /><span>{WD[toD(w.dt).getDay()]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="sheet">
        <h2><span>공개 일기</span></h2>
        {pubs.length ? pubs.map(x => (
          <div key={x.date}><p className="sub">{pretty(x.date)} {x.mood || ''}</p><p className="diary-ro">{x.diary}</p></div>
        )) : <p className="empty">{mine ? '오늘 탭의 일기에서 공개하기를 체크하면 여기에 보여요.' : '공개한 일기가 아직 없어요.'}</p>}
      </section>

      <section className="sheet">
        <h2><span>방명록</span></h2>
        <form className="addf" onSubmit={cheer}>
          <input className="inp" name="text" maxLength={100} placeholder={mine ? '오늘의 나에게 한마디' : '응원이나 잔소리 한마디'} aria-label="방명록 글" />
          <button className="btn pri">남기기</button>
        </form>
        <div>
          {S.cheers.length ? S.cheers.map(c => (
            <div className="cheer" key={c.id}>
              <div className="ava s">{avaOf(S, c.from)}</div>
              <p><b>{nickOf(S, c.from)}</b> <small>{(c.at || '').slice(0, 10).replace(/-/g, '.')}</small><br />{c.text}</p>
              {(c.from === S.uid || mine) && <ConfirmX onConfirm={() => act.delCheer(c.id)} />}
            </div>
          )) : <p className="empty">아직 방명록이 비어 있어요. 첫 글을 남겨 보세요.</p>}
        </div>
      </section>
    </div>
  )
}
