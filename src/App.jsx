import { useEffect, useState } from 'react'
import { useStore } from './hooks/useStore'
import Login from './components/Login'
import Onboard from './components/Onboard'
import Today from './components/Today'
import Hompy from './components/Hompy'
import Friends from './components/Friends'
import Bets from './components/Bets'
import Settings from './components/Settings'
import Categories from './components/Categories'

const TABS = [['today', '오늘'], ['cats', '카테고리'], ['hompy', '미니홈피'], ['friends', '친구'], ['bets', '내기']]
// 'cats/<id>' 는 카테고리 페이지
const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); return h === 'settings' || h.startsWith('cats/') || TABS.some(t => t[0] === h) ? h : 'today' }

export default function App() {
  const { S, act } = useStore()
  const [tab, setTab] = useState(fromHash)

  useEffect(() => {
    const on = () => setTab(fromHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])

  const go = k => {
    setTab(k)
    try { history.replaceState(null, '', '#' + k) } catch { /* 미리보기 iframe 등 */ }
    if (k === 'hompy' && !S.view) act.view(S.uid)
    if (k === 'friends' || k === 'bets') act.refresh()
  }

  const me = S.me
  const invites = me ? Object.values(S.ch).filter(c => c.members?.[S.uid] === 'invited').length : 0
  const added = me ? Object.keys(S.people).filter(id => id !== S.uid && (S.people[id].friends || []).includes(S.uid) && !me.friends.includes(id)).length : 0

  let body
  if (!S.ready || (S.uid && !S.loaded)) body = <div className="sheet"><h2><span>다이어리를 펼치는 중</span></h2><p className="sub">잠시만요. 루틴과 투두, 친구 목록을 불러오고 있어요.</p></div>
  else if (tab === 'settings') body = <Settings />
  else if (!S.uid) body = <Login />
  else if (!me) body = <Onboard />
  else if (tab === 'today') body = <Today />
  else if (tab === 'cats' || tab.startsWith('cats/')) body = <Categories catId={tab.slice(5)} />
  else if (tab === 'hompy') body = <Hompy />
  else if (tab === 'friends') body = <Friends />
  else body = <Bets />

  return (
    <>
      <div className="wrap">
        <header className="top">
          <h1 className="brand"><span>갓생홈피</span></h1>
          <nav className="tabs" role="tablist" aria-label="메뉴">
            {me && TABS.map(([k, l]) => (
              <button key={k} className="tab" role="tab" aria-selected={tab === k || (k === 'cats' && tab.startsWith('cats/'))} onClick={() => go(k)}>
                {l}{((k === 'bets' && invites) || (k === 'friends' && added)) ? <span className="dot" aria-label="새 소식" /> : null}
              </button>
            ))}
            {S.uid && !S.local && <button className="tab" onClick={act.signOut}>로그아웃</button>}
            <button className="tab" role="tab" aria-selected={tab === 'settings'} aria-label="설정"
              onClick={() => go(tab === 'settings' ? 'today' : 'settings')}>⚙️ 설정</button>
          </nav>
        </header>
        {S.local && <div className="note">지금은 미리보기 상태라 기록이 저장되지 않아요. .env.local 에 Supabase 키를 넣으면 저장되고 친구와 공유돼요.</div>}
        <main>{body}</main>
      </div>
      {S.toast && <div className="toast" role="status">{S.toast}</div>}
    </>
  )
}
