import { useEffect, useState } from 'react'
import { useStore } from './hooks/useStore'
import Login from './components/Login'
import Onboard from './components/Onboard'
import Today from './components/Today'
import Hompy from './components/Hompy'
import Friends from './components/Friends'
import Settings from './components/Settings'
import Categories from './components/Categories'
import ScheduleBubble from './components/ScheduleBubble'
import AppChrome from './components/AppChrome'

const TABS = [['today', '오늘'], ['cats', '활동'], ['hompy', '미니홈피'], ['friends', '친구']]
// 'cats/<id>' 는 활동 페이지
const fromHash = () => { const h = decodeURIComponent(location.hash.slice(1)); return h === 'settings' || h.startsWith('cats/') || TABS.some(t => t[0] === h) ? h : 'today' }

export default function App() {
  const { S, act } = useStore()
  const [tab, setTab] = useState(fromHash)

  useEffect(() => {
    const on = () => setTab(fromHash())
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])

  // 화면 설정(각자): 배경 색·무늬·이미지, 제목 형광펜 색·모양 → html 의 CSS 변수·data 속성
  const ui = S.ui || {}
  useEffect(() => {
    const r = document.documentElement, st = r.style
    if (ui.bg) { st.setProperty('--bg', ui.bg); st.setProperty('--grid', `color-mix(in srgb, ${ui.bg} 86%, #1B2440)`) } else { st.removeProperty('--bg'); st.removeProperty('--grid') }
    if (ui.mark) st.setProperty('--mark', ui.mark); else st.removeProperty('--mark')
    r.dataset.bgpat = ui.pattern || 'grid'
    r.dataset.mark = ui.markStyle || 'pen'
    if (ui.image) { st.setProperty('--bgimg', `url("${ui.image}")`); r.dataset.bgimg = '1' } else { st.removeProperty('--bgimg'); delete r.dataset.bgimg }
  }, [ui.bg, ui.mark, ui.pattern, ui.markStyle, ui.image])
  // 커서: 관리자가 올린 커서 중 내가 고른 것
  const cur = (S.site?.cursors || []).find(c => c.id === ui.cursor)
  const cursorCss = cur ? `url("${cur.image}") ${cur.hx ?? 4} ${cur.hy ?? 4}, auto` : ''
  useEffect(() => {
    const r = document.documentElement
    if (cursorCss) { r.style.setProperty('--cursor', cursorCss); r.dataset.cursor = '1' } else { r.style.removeProperty('--cursor'); delete r.dataset.cursor }
  }, [cursorCss])

  const go = k => {
    setTab(k)
    try { history.replaceState(null, '', '#' + k) } catch { /* 미리보기 iframe 등 */ }
    if (k === 'hompy' && !S.view) act.view(S.uid)
    if (k === 'friends') act.refresh()
  }

  const me = S.me
  const added = me ? Object.keys(S.people).filter(id => id !== S.uid && (S.people[id].friends || []).includes(S.uid) && !me.friends.includes(id)).length : 0

  let body
  if (!S.ready || (S.uid && !S.loaded)) body = <div className="sheet"><h2><span>다이어리를 펼치는 중</span></h2><p className="sub">잠시만요. 루틴과 투두, 친구 목록을 불러오고 있어요.</p></div>
  else if (tab === 'settings') body = <Settings />
  else if (!S.uid) body = <Login />
  else if (!me) body = <Onboard />
  else if (tab === 'today') body = <Today />
  else if (tab === 'cats' || tab.startsWith('cats/')) body = <Categories catId={tab.slice(5)} />
  else if (tab === 'hompy') body = <Hompy />
  else body = <Friends />

  return (
    <>
      <div className="wrap">
        <header className="top">
          <h1 className="brand"><span>갓생홈피</span></h1>
          <nav className="tabs" role="tablist" aria-label="메뉴">
            {me && TABS.map(([k, l]) => (
              <button key={k} className="tab" role="tab" aria-selected={tab === k || (k === 'cats' && tab.startsWith('cats/'))} onClick={() => go(k)}>
                {l}{k === 'friends' && added ? <span className="dot" aria-label="새 소식" /> : null}
              </button>
            ))}
          </nav>
        </header>
        {S.local && <div className="note">지금은 미리보기 상태라 기록이 저장되지 않아요. .env.local 에 Supabase 키를 넣으면 저장되고 친구와 공유돼요.</div>}
        <main>{body}</main>
      </div>
      {me && S.loaded && <ScheduleBubble />}
      <AppChrome />
      <button className={'gear' + (tab === 'settings' ? ' on' : '')} aria-label="설정" title="설정"
        onClick={() => go(tab === 'settings' ? 'today' : 'settings')}>⚙️</button>
      {S.toast && <div className="toast" role="status">{S.toast}</div>}
    </>
  )
}
