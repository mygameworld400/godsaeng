import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { validId } from '../services/authService'
import { AVA, AvaPicker, formVals } from './common'

export const ERR = {
  bad_code: '입장코드가 맞지 않아요.',
  bad_id: '아이디는 영문으로 시작하는 영문·숫자 3~16자예요.',
  taken: '이미 누가 쓰고 있는 아이디예요. 다른 아이디로 해 주세요.',
  bad_input: '닉네임은 16자까지, 비밀번호는 4자 이상이에요.',
  bad_admin: '관리자 코드가 맞지 않아요.',
}
export const explain = err => {
  const m = err?.message || ''
  const key = Object.keys(ERR).find(k => m.includes(k))
  if (key) return ERR[key]
  if (m.includes('Invalid login')) return '아이디나 비밀번호가 맞지 않아요.'
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
    if (up && !validId(v.login)) return setMsg(ERR.bad_id)
    setBusy(true); setMsg('')
    try {
      if (up) await act.register(v.code, v.login, v.password, v.nick, emoji)
      else await act.signIn(v.login, v.password)
    } catch (err) { setMsg(explain(err)) }
    setBusy(false)
  }

  return (
    <form className="sheet" onSubmit={submit} style={{ maxWidth: 520 }}>
      <h2><span>{up ? '갓생홈피 만들기' : '갓생홈피 입장'}</span></h2>
      <p className="sub">{up
        ? '홈피에서 쓸 닉네임과 로그인할 아이디·비밀번호를 정해요. 친구한테 받은 입장코드도 필요해요.'
        : '아이디와 비밀번호로 들어와요.'}</p>
      {up && <>
        <label htmlFor="li-nick">닉네임</label>
        <input className="inp" id="li-nick" name="nick" maxLength={16} placeholder="홈피에 보이는 이름 (예: 새벽러너 지니)" required />
        <p className="sub">닉네임은 나중에 홈피에서 언제든 바꿀 수 있어요.</p>
      </>}
      <label htmlFor="li-login">아이디</label>
      <input className="inp" id="li-login" name="login" maxLength={16} autoComplete="username" autoCapitalize="none" spellCheck={false}
        pattern="[A-Za-z][A-Za-z0-9]{2,15}" title="영문으로 시작하는 영문·숫자 3~16자" placeholder={up ? '로그인할 때 쓰는 아이디, 영문·숫자 3~16자 (예: jini99)' : ''} required />
      <label htmlFor="li-pw">비밀번호</label>
      <input className="inp" id="li-pw" name="password" type="password" minLength={4} autoComplete={up ? 'new-password' : 'current-password'} placeholder={up ? '4자 이상' : ''} required />
      {up && <>
        <label htmlFor="li-code">입장코드</label>
        <input className="inp" id="li-code" name="code" autoComplete="off" placeholder="친구한테 받은 코드" required />
        <AvaPicker value={emoji} onChange={setEmoji} />
      </>}
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
