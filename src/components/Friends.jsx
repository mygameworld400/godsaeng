import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { stat } from '../lib/stats'
import { CatGlyph, ConfirmX, Help, Modal, avaOf, nickOf, withImage } from './common'
import Hompy from './Hompy'

/* 친구 탭: 친구 목록(오늘 달성률) · 친구 찾기 · 친구들의 활동.
   '홈피'를 누르면 친구 미니홈피가 팝업으로 뜬다. 본문 글꼴은 Nanum Gothic (제목은 사이트 공통). */
export default function Friends() {
  const { S, act } = useStore()
  const [popup, setPopup] = useState(null)  // 팝업으로 연 홈피 주인 id
  const mineF = S.me.friends.filter(id => S.people[id])
  const others = Object.keys(S.people).filter(id => id !== S.uid)
  const addedMe = others.filter(id => (S.people[id].friends || []).includes(S.uid) && !S.me.friends.includes(id))
  const rest = others.filter(id => !S.me.friends.includes(id) && !addedMe.includes(id))

  const openHompy = id => { act.view(id); setPopup(id) }
  const closeHompy = () => { setPopup(null); act.view(S.uid) }

  // 렌더 함수 (컴포넌트로 만들면 렌더마다 다시 마운트됨). 닉네임 옆에 한줄소개를 한 줄로.
  const person = (id, right) => (
    <div className="person" key={id}>
      <div className="ava s">{avaOf(S, id)}</div>
      <div className="nm"><b>{nickOf(S, id)}</b>{S.people[id]?.bio && <span className="pbio">{S.people[id].bio}</span>}</div>
      {right}
    </div>
  )

  return (
    <div className="stack friends-page">
      <section className="sheet">
        <h2><span>친구 목록</span><Help>내가 추가한 친구들이에요. 오른쪽 숫자는 친구의 오늘 달성률이에요.</Help></h2>
        <div>
          {mineF.length ? mineF.map(id => {
            const s = stat(S.people[id], S.fday[id], false)
            return person(id, <>
              <span className="pct">{s.pct}%</span>
              <button className="btn sm" onClick={() => openHompy(id)}>홈피</button>
              <ConfirmX onConfirm={() => act.delFriend(id)} />
            </>)
          }) : <p className="empty">아직 친구가 없어요. 아래 친구 찾기에서 추가해 보세요.</p>}
        </div>
      </section>

      <section className="sheet">
        <h2><span>친구 찾기</span><Help>친구가 안 보이면 친구가 이 사이트에 가입했는지 확인해 주세요. 가입한 사람만 여기에 나타나요.</Help></h2>
        {addedMe.length > 0 && <>
          <p className="sub">나를 친구로 추가한 사람</p>
          <div>{addedMe.map(id => person(id, <>
            <button className="btn sm" onClick={() => openHompy(id)}>홈피</button>
            <button className="btn sm pri" onClick={() => act.addFriend(id)}>나도 추가</button>
          </>))}</div>
        </>}
        <p className="sub">이 다이어리를 쓰는 사람</p>
        <div>
          {rest.length ? rest.map(id => person(id, <>
            <button className="btn sm" onClick={() => openHompy(id)}>홈피</button>
            <button className="btn sm pri" onClick={() => act.addFriend(id)}>친구 추가</button>
          </>)) : <p className="empty">아직 추가할 사람이 없어요.</p>}
        </div>
      </section>

      <section className="sheet">
        <h2><span>친구들의 활동</span><Help>친구들이 활동 탭에 담아 둔 활동이에요.</Help></h2>
        {mineF.length ? mineF.map(id => {
          const cats = S.people[id].cats || []
          return (
            <div className="person" key={id}>
              <div className="ava s">{avaOf(S, id)}</div>
              <div className="nm"><b>{nickOf(S, id)}</b></div>
              <div className="fcats">
                {cats.length ? cats.map(c => (
                  <span className="fcat" key={c.id} title={c.name}><CatGlyph cat={withImage(c, S.baseCats)} size={26} /><small>{c.name}</small></span>
                )) : <small className="sub">아직 담은 활동이 없어요</small>}
              </div>
            </div>
          )
        }) : <p className="empty">친구를 추가하면 친구들이 하는 활동이 여기에 보여요.</p>}
      </section>

      {popup && (
        <Modal wide title={`${nickOf(S, popup)}의 홈피`} onClose={closeHompy}>
          <Hompy popup />
        </Modal>
      )}
    </div>
  )
}
