import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { stat } from '../lib/stats'
import { ConfirmX, Help, Modal, avaOf, nickOf } from './common'
import Hompy from './Hompy'

/* 친구 탭: 친구 목록(오늘 달성률). ＋ 를 누르면 친구 찾기 팝업.
   '홈피'를 누르면 친구 미니홈피가 팝업으로 뜬다. 본문 글꼴은 Nanum Gothic (제목은 사이트 공통). */
export default function Friends() {
  const { S, act } = useStore()
  const [popup, setPopup] = useState(null)  // 팝업으로 연 홈피 주인 id
  const [finding, setFinding] = useState(false)  // 친구 찾기 팝업
  const mineF = S.me.friends.filter(id => S.people[id])
  const others = Object.keys(S.people).filter(id => id !== S.uid)
  const addedMe = others.filter(id => (S.people[id].friends || []).includes(S.uid) && !S.me.friends.includes(id))
  const rest = others.filter(id => !S.me.friends.includes(id) && !addedMe.includes(id))

  const openHompy = id => { setFinding(false); act.view(id); setPopup(id) }
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
        <h2><span>친구 목록</span><Help>내가 추가한 친구들이에요. 오른쪽 숫자는 친구의 오늘 달성률이에요. ＋ 를 누르면 친구를 찾아 추가할 수 있어요.</Help>
          <button className="plus" aria-label="친구 찾기" title="친구 찾기" onClick={() => setFinding(true)}>＋</button></h2>
        <div>
          {mineF.length ? mineF.map(id => {
            const s = stat(S.people[id], S.fday[id], false)
            return person(id, <>
              <span className="pct">{s.pct}%</span>
              <button className="btn sm" onClick={() => openHompy(id)}>홈피</button>
              <ConfirmX onConfirm={() => act.delFriend(id)} />
            </>)
          }) : <p className="empty">아직 친구가 없어요. 위의 ＋ 를 눌러 친구를 찾아 보세요.</p>}
        </div>
      </section>

      {finding && (
        <Modal title="친구 찾기" onClose={() => setFinding(false)}>
          <div className="friends-page stack" style={{ gap: 8 }}>
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
          </div>
        </Modal>
      )}

      {popup && (
        <Modal wide title={`${nickOf(S, popup)}의 홈피`} onClose={closeHompy}>
          <Hompy popup />
        </Modal>
      )}
    </div>
  )
}
