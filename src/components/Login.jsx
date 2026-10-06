import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import { formVals } from './common'

export default function Login() {
  const { act } = useStore()
  const [mode, setMode] = useState('in')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async e => {
    const { email, password } = formVals(e)
    setBusy(true); setMsg('')
    try {
      if (mode === 'in') await act.signIn(email, password)
      else {
        const r = await act.signUp(email, password)
        if (!r.session) setMsg('가입 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
      }
    } catch (err) {
      setMsg(err.message?.includes('Invalid login') ? '이메일이나 비밀번호가 맞지 않아요.' : '잠시 뒤에 다시 해 주세요. (' + err.message + ')')
    }
    setBusy(false)
  }

  return (
    <form className="sheet" onSubmit={submit} style={{ maxWidth: 520 }}>
      <h2><span>{mode === 'in' ? '다이어리 열기' : '새 다이어리 만들기'}</span></h2>
      <p className="sub">친구들과 루틴, 투두, 내기를 같이 보려면 로그인이 필요해요.</p>
      <label htmlFor="li-email">이메일</label>
      <input className="inp" id="li-email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="li-pw">비밀번호</label>
      <input className="inp" id="li-pw" name="password" type="password" minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required />
      {msg && <p className="sub">{msg}</p>}
      <div className="row">
        <button className="btn pri" disabled={busy}>{mode === 'in' ? '로그인' : '가입하기'}</button>
        <button type="button" className="btn" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg('') }}>
          {mode === 'in' ? '처음이에요' : '이미 계정이 있어요'}
        </button>
      </div>
    </form>
  )
}
