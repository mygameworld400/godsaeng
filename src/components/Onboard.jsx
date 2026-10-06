import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { AVA, AvaPicker, formVals } from './common'

export default function Onboard() {
  const { act } = useStore()
  const [emoji, setEmoji] = useState(AVA[0])
  return (
    <form className="sheet" style={{ maxWidth: 520 }} onSubmit={e => { const { nick } = formVals(e); if (nick) act.join(nick, emoji) }}>
      <h2><span>다이어리 첫 장</span></h2>
      <p className="sub">친구들이 알아볼 닉네임과 얼굴을 정하면 내 루틴, 투두, 미니홈피가 만들어져요.</p>
      <label htmlFor="join-nick">닉네임</label>
      <input className="inp" id="join-nick" name="nick" maxLength={16} placeholder="예: 새벽러너 지니" required />
      <AvaPicker value={emoji} onChange={setEmoji} />
      <div className="row"><button className="btn pri">시작하기</button></div>
    </form>
  )
}
