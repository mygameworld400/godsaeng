import { useState } from 'react'
import { useStore } from '../hooks/useStore'
import * as admin from '../services/adminService'
import { ConfirmX, formVals } from './common'
import { explain } from './Login'

/* 설정: 화면 설정(추후 폰트 등) + 관리자 모드.
   관리자 코드는 이 화면 state 에만 들고 있다가 함수 호출마다 같이 보낸다 (새로고침하면 다시 입력). */

const fmt = s => s ? s.slice(0, 16).replace('T', ' ').replace(/-/g, '.') : '-'

function AccountRow({ a, code, onDone, toast }) {
  const [edit, setEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const save = async e => {
    const v = formVals(e)
    setBusy(true)
    try {
      await admin.updateAccount(code, a.id, v)
      toast(v.password ? '저장했어요. 새 비밀번호를 본인에게 알려 주세요.' : '저장했어요.')
      setEdit(false); onDone()
    } catch (err) { toast(explain(err)) }
    setBusy(false)
  }
  const del = async () => {
    try { await admin.deleteAccount(code, a.id); toast(`${a.nick} 계정을 지웠어요.`); onDone() } catch (err) { toast(explain(err)) }
  }
  return (
    <div className="acct">
      <div className="person">
        <div className="ava s">{a.emoji}</div>
        <div className="nm">{a.nick}<small>아이디 <b>{a.login}</b> · 가입 {fmt(a.createdAt)} · 최근 접속 {fmt(a.lastSignIn)}</small></div>
        <button className="btn sm" onClick={() => setEdit(!edit)}>{edit ? '닫기' : '수정'}</button>
        <ConfirmX onConfirm={del} label="삭제" className="btn sm warn" />
      </div>
      {edit && (
        <form className="addf col" onSubmit={save}>
          <label>아이디<input className="inp" name="login" defaultValue={a.login} maxLength={16} autoCapitalize="none" spellCheck={false} /></label>
          <label>닉네임<input className="inp" name="nick" defaultValue={a.nick} maxLength={16} /></label>
          <label>새 비밀번호<input className="inp" name="password" type="text" minLength={4} autoComplete="off" placeholder="비워 두면 그대로" /></label>
          <p className="sub">비밀번호는 암호화돼 저장돼서 원래 값은 볼 수 없어요. 잊어버린 친구는 여기서 새 비밀번호로 바꿔 주세요.</p>
          <div className="row"><button className="btn pri" disabled={busy}>저장</button></div>
        </form>
      )}
    </div>
  )
}

export default function Settings() {
  const { S, act } = useStore()
  const [code, setCode] = useState('')
  const [list, setList] = useState(null)
  const [msg, setMsg] = useState('')

  const load = async c => {
    try { setList(await admin.listAccounts(c)); setCode(c); setMsg('') } catch (err) { setMsg(explain(err)) }
  }

  return (
    <div className="stack">
      <section className="sheet">
        <h2><span>화면 설정</span></h2>
        <p className="empty">폰트 설정 같은 화면 옵션이 여기에 들어올 예정이에요.</p>
      </section>

      <section className="sheet">
        <div className="row between">
          <h2><span>관리자 모드</span></h2>
          {list && <button className="btn sm" onClick={() => { setList(null); setCode('') }}>나가기</button>}
        </div>
        {S.local ? <p className="empty">미리보기 상태에서는 관리자 모드를 쓸 수 없어요.</p>
          : !list ? (
            <form className="addf" onSubmit={e => { const v = formVals(e); if (v.code) load(v.code) }}>
              <input className="inp" name="code" type="password" autoComplete="off" placeholder="관리자 코드" aria-label="관리자 코드" />
              <button className="btn pri">들어가기</button>
              {msg && <p className="sub" role="alert" style={{ flexBasis: '100%' }}>{msg}</p>}
            </form>
          ) : <>
            <p className="sub">가입한 계정 {list.length}개예요. 아이디·닉네임·비밀번호를 바꾸거나 계정을 지울 수 있어요. 지운 계정의 기록은 되살릴 수 없어요.</p>
            <div>
              {list.length ? list.map(a => (
                <AccountRow key={a.id} a={a} code={code} toast={act.toast} onDone={() => { load(code); act.refresh() }} />
              )) : <p className="empty">아직 가입한 계정이 없어요.</p>}
            </div>
          </>}
      </section>
    </div>
  )
}
