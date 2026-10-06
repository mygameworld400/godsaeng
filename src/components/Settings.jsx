import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import * as admin from '../services/adminService'
import * as categories from '../services/categoryService'
import { COLORS, ConfirmX, formVals } from './common'
import { makeIcon } from '../lib/cutout'
import { explain } from './Login'
import { localDateTime } from '../lib/date'

/* 설정: 화면 설정(추후 폰트 등) + 관리자 모드.
   관리자 코드는 이 화면 state 에만 들고 있다가 함수 호출마다 같이 보낸다 (새로고침하면 다시 입력). */

const fmt = s => localDateTime(s) || '-'

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

/** 기본 카테고리 한 줄: 이미지(누끼 제거)·이모지·이름·색·순서 수정, 삭제 */
function BaseCatForm({ c, code, onDone, toast }) {
  const [file, setFile] = useState(null)
  const [cut, setCut] = useState(true)
  const [tol, setTol] = useState(28)
  const [preview, setPreview] = useState('')   // 새로 만든 이미지 data URL
  const [clear, setClear] = useState(false)    // 기존 이미지 지우기
  const [busy, setBusy] = useState(false)

  // 파일·누끼 옵션이 바뀌면 미리보기를 다시 만든다
  useEffect(() => {
    if (!file) return
    let live = true
    makeIcon(file, { cutout: cut, tolerance: tol }).then(u => { if (live) setPreview(u) }).catch(e => toast(e.message))
    return () => { live = false }
  }, [file, cut, tol, toast])

  const shown = preview || (clear ? '' : c?.image || '')
  const save = async e => {
    const form = e.currentTarget, v = formVals(e)
    if (!v.name) return
    setBusy(true)
    try {
      await categories.adminSaveBaseCat(code, {
        id: c?.id, name: v.name, icon: v.icon, color: v.color, sort: +v.sort || 0,
        image: preview || (clear ? '' : undefined),
      })
      toast(c ? '저장했어요.' : '기본 카테고리를 추가했어요.')
      if (!c) { form.reset(); setFile(null); setPreview('') }
      onDone()
    } catch (err) { toast(explain(err)) }
    setBusy(false)
  }
  const del = async () => {
    try { await categories.adminDeleteBaseCat(code, c.id); toast('지웠어요. 이미 추가한 사람의 카테고리는 남아 있어요.'); onDone() } catch (err) { toast(explain(err)) }
  }
  return (
    <form className="basecat" onSubmit={save}>
      <div className="basecat-img">
        <div className="checker">{shown ? <img src={shown} alt="아이콘 미리보기" /> : <span>{c?.icon || '🏷️'}</span>}</div>
        <label className="btn sm">이미지 {shown ? '바꾸기' : '올리기'}
          <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setClear(false) } e.target.value = '' }} />
        </label>
        {shown && <button type="button" className="x" onClick={() => { setFile(null); setPreview(''); setClear(true) }}>이미지 빼기</button>}
      </div>
      <div className="basecat-fields">
        <div className="addf">
          <input className="inp" name="icon" defaultValue={c?.icon || ''} maxLength={4} placeholder="🏷️" aria-label="이모지 (이미지가 없을 때)" title="이미지가 없을 때 쓰는 이모지" style={{ flex: '0 0 64px' }} />
          <input className="inp" name="name" defaultValue={c?.name || ''} maxLength={12} placeholder="카테고리 이름" aria-label="이름" required />
          <select className="inp" name="color" defaultValue={c?.color || 'c1'} aria-label="색">
            {COLORS.map((k, i) => <option key={k} value={k}>색 {i + 1}</option>)}
          </select>
          <input className="inp" name="sort" type="number" defaultValue={c?.sort ?? 0} aria-label="순서" title="작을수록 앞" style={{ flex: '0 0 70px' }} />
        </div>
        {file && (
          <div className="row">
            <label className="toggle"><input type="checkbox" checked={cut} onChange={e => setCut(e.target.checked)} /> 배경 자동 제거</label>
            {cut && <label className="toggle">강도 <input type="range" min={5} max={80} value={tol} onChange={e => setTol(+e.target.value)} /></label>}
            <span className="sub">배경이 덜 지워지면 강도를 올리고, 그림이 같이 지워지면 내려 주세요.</span>
          </div>
        )}
        <div className="row">
          <button className="btn pri sm" disabled={busy}>{c ? '저장' : '추가'}</button>
          {c && <ConfirmX onConfirm={del} label="삭제" className="btn sm warn" />}
        </div>
      </div>
    </form>
  )
}

export default function Settings() {
  const { S, act } = useStore()
  const [code, setCode] = useState('')
  const [list, setList] = useState(null)
  const [baseCats, setBaseCats] = useState([])
  const [msg, setMsg] = useState('')

  const load = async c => {
    try {
      const [accts, base] = await Promise.all([admin.listAccounts(c), categories.adminListBaseCats(c)])
      setList(accts); setBaseCats(base); setCode(c); setMsg('')
    } catch (err) { setMsg(explain(err)) }
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
            <h2><span>기본 카테고리</span></h2>
            <p className="sub">모두에게 보이는 기본 카테고리예요. 각자 카테고리 탭에서 골라 추가해요. 이미지를 올리면 이모지 대신 이미지가 아이콘이 돼요. 순서는 숫자가 작을수록 앞이에요.</p>
            <div className="stack" style={{ gap: 10 }}>
              {baseCats.map(c => <BaseCatForm key={c.id + c.name + c.icon + c.color + c.sort + c.image.length} c={c} code={code} toast={act.toast} onDone={() => { load(code); act.refresh() }} />)}
              <BaseCatForm code={code} toast={act.toast} onDone={() => { load(code); act.refresh() }} />
            </div>
          </>}
      </section>
    </div>
  )
}
