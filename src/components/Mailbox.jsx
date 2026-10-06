import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import * as fb from '../services/feedbackService'
import { localDateTime } from '../lib/date'
import { ConfirmX, Help, Modal } from './common'
import { explain } from './Login'

/* 우체통 (왼쪽 아래): 피드백 보내기 — 익명/닉네임, 공개/비공개.
   공개 글과 내 글이 보이고, 관리자 코드를 넣으면 모든 글을 보고 답장·처리 상태를 바꿀 수 있다. */

const STATUS = { new: '접수', checking: '확인 중', done: '처리 완료' }

function Item({ f, admin, code, reload, toast }) {
  const [reply, setReply] = useState(f.reply || '')
  const [status, setStatus] = useState(f.status)
  const save = async () => { try { await fb.adminUpdateFeedback(code, f.id, status, reply); toast('저장했어요.'); reload() } catch (e) { toast(explain(e)) } }
  return (
    <div className={'fb st-' + f.status}>
      <div className="row between">
        <span className="sub">{f.author || '익명'}{!f.public && ' · 🔒 비공개'} · {localDateTime(f.created_at)}</span>
        <span className="pill">{STATUS[f.status]}</span>
      </div>
      <p className="plan-text">{f.body}</p>
      {!admin && f.reply && <p className="fb-reply">💬 관리자: {f.reply}</p>}
      {admin && <>
        <textarea className="inp" rows={2} value={reply} onChange={e => setReply(e.target.value)} placeholder="답장 (모두에게 보여요, 비공개 글은 작성자만)" aria-label="답장" />
        <div className="row">
          {Object.entries(STATUS).map(([k, l]) => <button key={k} className={'btn sm' + (status === k ? ' hl' : '')} onClick={() => setStatus(k)}>{l}</button>)}
          <button className="btn pri sm" onClick={save}>저장</button>
        </div>
      </>}
      {!admin && f.mine && <ConfirmX onConfirm={async () => { try { await fb.deleteFeedback(f.id); reload() } catch (e) { toast(explain(e)) } }} label="내 글 지우기" className="x" />}
    </div>
  )
}

export default function Mailbox() {
  const { S, act } = useStore()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(null)
  const [body, setBody] = useState('')
  const [anon, setAnon] = useState(false)
  const [pub, setPub] = useState(true)
  const [code, setCode] = useState('')     // 관리자 코드가 맞으면 채워짐
  const [askCode, setAskCode] = useState(false)
  const [err, setErr] = useState('')

  const reload = async (c = code) => {
    try { setList(c ? await fb.adminFeedback(c) : await fb.listFeedback()); setErr('') } catch (e) { setList([]); setErr(explain(e)) }
  }
  useEffect(() => { if (open) reload() }, [open])  // eslint-disable-line react-hooks/exhaustive-deps

  const send = async () => {
    if (!body.trim()) return
    if (S.local) return act.toast('미리보기에서는 보낼 수 없어요.')
    try { await fb.sendFeedback(S.uid, { body: body.trim(), anonymous: anon, public: pub }); setBody(''); act.toast('우체통에 넣었어요. 고마워요!'); reload() } catch (e) { act.toast(explain(e)) }
  }
  const tryCode = async c => { try { const l = await fb.adminFeedback(c); setCode(c); setList(l); setAskCode(false) } catch (e) { act.toast(explain(e)) } }

  return <>
    <button className="mailbox" onClick={() => setOpen(true)} title="우체통 (피드백)" aria-label="우체통">📮</button>
    {open && (
      <Modal title={code ? '우체통 · 관리자' : '우체통'} onClose={() => { setOpen(false); setCode('') }}>
        {!code && <>
          <textarea className="inp" rows={4} maxLength={2000} value={body} onChange={e => setBody(e.target.value)} placeholder="불편한 점, 바라는 기능, 응원 한마디 무엇이든!" aria-label="피드백" />
          <div className="row">
            <button className={'btn sm' + (anon ? ' hl' : '')} onClick={() => setAnon(!anon)}>{anon ? '🙈 익명' : '🙂 닉네임'}</button>
            <button className={'btn sm' + (pub ? '' : ' hl')} onClick={() => setPub(!pub)}>{pub ? '🌐 공개' : '🔒 비공개'}</button>
            <Help>익명이면 다른 사람에게 이름이 안 보여요. 비공개면 나와 관리자만 볼 수 있어요.</Help>
            <button className="btn pri sm" style={{ marginLeft: 'auto' }} onClick={send}>보내기</button>
          </div>
        </>}
        <div className="row between">
          <b className="sub">{code ? '모든 피드백' : '공개된 피드백 · 내가 쓴 글'}</b>
          {code ? <button className="btn sm" onClick={() => { setCode(''); reload('') }}>관리자 나가기</button>
            : <button className="btn sm" onClick={() => setAskCode(!askCode)}>🔑 관리자</button>}
        </div>
        {askCode && !code && (
          <form className="addf" onSubmit={e => { e.preventDefault(); const c = new FormData(e.currentTarget).get('c'); if (c) tryCode(String(c)) }}>
            <input className="inp" name="c" type="password" placeholder="관리자 코드" aria-label="관리자 코드" autoComplete="off" />
            <button className="btn pri sm">들어가기</button>
          </form>
        )}
        {err && <p className="sub">{err}</p>}
        <div className="stack" style={{ gap: 8 }}>
          {!list ? <p className="empty">불러오는 중…</p> : list.length ? list.map(f => <Item key={f.id + f.status + f.reply} f={f} admin={!!code} code={code} reload={reload} toast={act.toast} />)
            : <p className="empty">아직 편지가 없어요.</p>}
        </div>
      </Modal>
    )}
  </>
}
