import { useStore } from '../hooks/useStore'
import { today, pretty } from '../lib/date'
import { stat } from '../lib/stats'
import { ConfirmX, Help, avaOf, nickOf } from './common'

export default function Friends() {
  const { S, act } = useStore()
  const mineF = S.me.friends, others = Object.keys(S.people).filter(id => id !== S.uid)
  const addedMe = others.filter(id => (S.people[id].friends || []).includes(S.uid) && !mineF.includes(id))
  const rest = others.filter(id => !mineF.includes(id) && !addedMe.includes(id))
  const t = today()
  const rows = [
    { id: S.uid, s: stat(S.me, S.days[t], true) },
    ...mineF.filter(id => S.people[id]).map(id => ({ id, s: stat(S.people[id], S.fday[id], false) })),
  ].sort((a, b) => b.s.pct - a.s.pct)

  const Person = ({ id, children }) => (
    <div className="person">
      <div className="ava s">{avaOf(S, id)}</div>
      <div className="nm">{nickOf(S, id)}<small>{S.people[id]?.bio || ''}</small></div>
      {children}
    </div>
  )

  return (
    <div className="cols">
      <section className="sheet">
        <h2><span>오늘의 친구 순위</span><Help>{pretty(t)} 달성률이 높은 순서예요.</Help></h2>
        <div>
          {rows.map(r => (
            <Person key={r.id} id={r.id}>
              <div className="meter" aria-hidden="true"><i style={{ width: r.s.pct + '%' }} /></div>
              <span className="pct">{r.s.pct}%</span>
              {r.id === S.uid ? <span className="pill">나</span> : <>
                <button className="btn sm" onClick={() => act.view(r.id)}>홈피</button>
                <ConfirmX onConfirm={() => act.delFriend(r.id)} />
              </>}
            </Person>
          ))}
        </div>
        {!mineF.length && <p className="empty">아직 친구가 없어요. 옆 목록에서 친구를 추가해 보세요.</p>}
      </section>

      <section className="sheet">
        <h2><span>친구 찾기</span><Help>친구가 안 보이면 친구가 이 사이트에 가입했는지 확인해 주세요. 가입한 사람만 여기에 나타나요.</Help></h2>
        {addedMe.length > 0 && <>
          <p className="sub">나를 친구로 추가한 사람</p>
          <div>{addedMe.map(id => (
            <Person key={id} id={id}><button className="btn sm pri" onClick={() => act.addFriend(id)}>나도 추가</button></Person>
          ))}</div>
        </>}
        <p className="sub">이 다이어리를 쓰는 사람</p>
        <div>
          {rest.length ? rest.map(id => (
            <Person key={id} id={id}>
              <button className="btn sm" onClick={() => act.view(id)}>홈피</button>
              <button className="btn sm pri" onClick={() => act.addFriend(id)}>친구 추가</button>
            </Person>
          )) : <p className="empty">아직 추가할 사람이 없어요.</p>}
        </div>
      </section>
    </div>
  )
}
