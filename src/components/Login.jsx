import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { AVA, AvaPicker, formVals } from './common'

const ERR = {
  bad_code: '입장코드가 맞지 않아요.',
  taken: '이미 누가 쓰고 있는 닉네임이에요. 다른 닉네임으로 해 주세요.',
  bad_input: '닉네임은 16자까지, 비밀번호는 4자 이상이에요.',
}
const explain = err => {
  const m = err?.message || ''
  const key = Object.keys(ERR).find(k => m.includes(k))
  if (key) return ERR[key]
  if (m.includes('Invalid login')) return '닉네임이나 비밀번호가 맞지 않아요.'
  return '잠시 뒤에 다시 해 주세요. (' + m + ')'
}

export default function Login() {
  const { act } = useStore()
  const [mode, setMode] = useState('in')
  const [emoji, setEmoji] = useState(AVA[0])
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const up = mode === 'up'

  const submit = async e => {
    const v = formVals(e)
    setBusy(true); setMsg('')
    try {
      if (up) await act.register(v.code, v.handle, v.password, emoji)
      else await act.signIn(v.handle, v.password)
    } catch (err) { setMsg(explain(err)) }
    setBusy(false)
  }

  return (
    <form className="sheet" onSubmit={submit} style={{ maxWidth: 520 }}>
      <h2><span>{up ? '다이어리 첫 장' : '다이어리 열기'}</span></h2>
      <p className="sub">{up
        ? '친구한테 받은 입장코드를 넣고, 앞으로 쓸 닉네임과 비밀번호를 정해요. 닉네임이 로그인 아이디가 돼요.'
        : '가입할 때 정한 닉네임과 비밀번호로 들어와요.'}</p>
      {up && <>
        <label htmlFor="li-code">입장코드</label>
        <input className="inp" id="li-code" name="code" autoComplete="off" required />
      </>}
      <label htmlFor="li-handle">닉네임</label>
      <input className="inp" id="li-handle" name="handle" maxLength={16} autoComplete="username" placeholder={up ? '예: 새벽러너 지니' : ''} required />
      <label htmlFor="li-pw">비밀번호</label>
      <input className="inp" id="li-pw" name="password" type="password" minLength={4} autoComplete={up ? 'new-password' : 'current-password'} required />
      {up && <AvaPicker value={emoji} onChange={setEmoji} />}
      {msg && <p className="sub" role="alert">{msg}</p>}
      <div className="row">
        <button className="btn pri" disabled={busy}>{up ? '시작하기' : '들어가기'}</button>
        <button type="button" className="btn" onClick={() => { setMode(up ? 'in' : 'up'); setMsg('') }}>
          {up ? '이미 가입했어요' : '처음이에요'}
        </button>
      </div>
    </form>
  )
}
