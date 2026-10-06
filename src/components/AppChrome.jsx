import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import { CHANGELOG, VERSION } from '../lib/changelog'
import Mailbox from './Mailbox'
import { Modal } from './common'

/* 화면 모서리에 떠 있는 것들:
   왼쪽 위 위블 아이콘(위블 계정만) · 왼쪽 아래 우체통 · 오른쪽 아래 버전 · 새 배포 알림 팝업 */

const BUILD = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'

function useNewVersion() {
  const [fresh, setFresh] = useState(false)
  useEffect(() => {
    if (BUILD === 'dev') return
    const check = () => fetch(import.meta.env.BASE_URL + 'version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null).then(j => { if (j?.id && j.id !== BUILD) setFresh(true) }).catch(() => {})
    const vis = () => { if (document.visibilityState === 'visible') check() }
    const iv = setInterval(check, 60000)
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis) }
  }, [])
  return fresh
}

export default function AppChrome() {
  const { S } = useStore()
  const fresh = useNewVersion()
  const [log, setLog] = useState(false)
  const [later, setLater] = useState(false)
  const weble = S.site?.weble
  const isWeble = !!(S.uid && weble?.users?.includes(S.uid))

  return <>
    {isWeble && weble.link && (
      <a className="weble" href={weble.link} target="_blank" rel="noreferrer" title="위블">
        {weble.icon ? <img src={weble.icon} alt="위블" /> : <span>🔗</span>}
      </a>
    )}
    {S.me && <Mailbox />}
    <button className="ver" onClick={() => setLog(true)} title="버전 기록">v{VERSION}</button>
    {log && (
      <Modal title="버전 기록" onClose={() => setLog(false)}>
        <div className="changelog">{CHANGELOG.map(c => (
          <div key={c.v}><b>v{c.v}</b> <small className="sub">{c.date}</small>
            <ul>{c.items.map(i => <li key={i}>{i}</li>)}</ul></div>
        ))}</div>
      </Modal>
    )}
    {fresh && !later && (
      <div className="modal-bg"><div className="modal update" role="alertdialog" aria-label="업데이트">
        <p className="update-t">업데이트가 있어요!</p>
        <p className="sub">새 버전이 배포됐어요. 새로고침하면 바로 쓸 수 있어요.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn pri" onClick={() => location.reload()}>새로고침</button>
          <button className="btn" onClick={() => setLater(true)}>나중에</button>
        </div>
      </div></div>
    )}
  </>
}
