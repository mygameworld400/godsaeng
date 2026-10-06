import { useEffect, useState } from 'react'
import { useStore } from '../hooks/useStore'
import * as admin from '../services/adminService'
import * as categories from '../services/categoryService'
import * as plans from '../services/planService'
import * as questApi from '../services/questService'
import * as bookApi from '../services/bookService'
import * as siteApi from '../services/siteService'
import PlanViewer from './PlanViewer'
import { COLORS, ConfirmX, Fold, Help, Modal, avaOf, formVals } from './common'
import { makeIcon, makeBackground, makeCover, makeCursor, splitStickers, finishSticker } from '../lib/cutout'
import StickerEditor from './StickerEditor'
import { readCur } from '../lib/curfile'
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
        <div className="nm">{a.nick}{a.otherApp && <span className="pill" style={{ marginLeft: 6 }}>다른 앱 계정</span>}
          <small>아이디 <b>{a.login || '없음'}</b> · 가입 {fmt(a.createdAt)} · 최근 접속 {fmt(a.lastSignIn)}</small>
          {a.otherApp && <small>미니홈 등 다른 앱 로그인으로 만들어진 프로필이에요. 삭제하면 갓생홈피 기록만 지워지고 원래 계정은 남아요.</small>}</div>
        <button className="btn sm" onClick={() => setEdit(!edit)}>{edit ? '닫기' : '수정'}</button>
        <ConfirmX onConfirm={del} label="삭제" className="btn sm warn" />
      </div>
      {edit && (
        <form className="addf col" onSubmit={save}>
          <label>아이디<input className="inp" name="login" defaultValue={a.login} maxLength={16} autoCapitalize="none" spellCheck={false} /></label>
          <label>닉네임<input className="inp" name="nick" defaultValue={a.nick} maxLength={16} /></label>
          <label>새 비밀번호 <Help>비밀번호는 암호화돼 저장돼서 원래 값은 볼 수 없어요. 잊어버린 친구는 여기서 새 비밀번호로 바꿔 주세요.</Help><input className="inp" name="password" type="text" minLength={4} autoComplete="off" placeholder="비워 두면 그대로" /></label>
          <div className="row"><button className="btn pri" disabled={busy}>저장</button></div>
        </form>
      )}
    </div>
  )
}

/** 하위 선택지 편집 (예: 언어 → 영어, 일본어). 각 선택지는 이름 + 이모지 + (선택) 이미지 */
function OptionsEditor({ opts, setOpts, toast }) {
  const upd = (i, patch) => setOpts(opts.map((o, j) => j === i ? { ...o, ...patch } : o))
  const upload = async (i, f) => { try { upd(i, { image: await makeIcon(f, { cutout: true, tolerance: 28 }) }) } catch (e) { toast(e.message) } }
  return (
    <div className="opts">
      <span className="sub">하위 선택지 <Help>예: 언어 → 영어, 일본어. 선택지가 있으면 추천 활동에서 누를 때 팝업으로 하나를 고르고, 고른 선택지의 이름·아이콘으로 담겨요. 이미지는 배경이 자동으로 지워져요.</Help></span>
      {opts.map((o, i) => (
        <div className="addf" key={o.id}>
          <span className="checker sm">{o.image ? <img src={o.image} alt="" /> : <span>{o.icon || '·'}</span>}</span>
          <input className="inp" value={o.icon || ''} onChange={e => upd(i, { icon: e.target.value })} maxLength={4} placeholder="🇺🇸" aria-label="선택지 이모지" style={{ flex: '0 0 56px' }} />
          <input className="inp" value={o.name} onChange={e => upd(i, { name: e.target.value })} maxLength={12} placeholder="예: 영어" aria-label="선택지 이름" />
          <label className="btn sm">이미지<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(i, f); e.target.value = '' }} /></label>
          {o.image && <button type="button" className="x" onClick={() => upd(i, { image: '' })}>이미지 빼기</button>}
          <button type="button" className="x" aria-label="선택지 삭제" onClick={() => setOpts(opts.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }}
        onClick={() => setOpts([...opts, { id: Math.random().toString(36).slice(2, 9), name: '', icon: '', image: '' }])}>+ 선택지 추가</button>
    </div>
  )
}

/** 기본 활동 한 줄: 이미지(누끼 제거)·이모지·이름·색·순서 수정, 삭제 */
function BaseCatForm({ c, code, onDone, toast }) {
  const [file, setFile] = useState(null)
  const [cut, setCut] = useState(true)
  const [tol, setTol] = useState(28)
  const [preview, setPreview] = useState('')   // 새로 만든 이미지 data URL
  const [clear, setClear] = useState(false)    // 기존 이미지 지우기
  const [busy, setBusy] = useState(false)
  const [opts, setOpts] = useState(c?.options || [])  // 하위 선택지

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
        image: preview || (clear ? '' : undefined), kind: v.kind || 'default', subtitle: v.subtitle ?? '',
        options: opts.filter(o => o.name.trim()).map(o => ({ ...o, name: o.name.trim() })),
      })
      toast(c ? '저장했어요.' : '기본 활동을 추가했어요.')
      if (!c) { form.reset(); setFile(null); setPreview(''); setOpts([]) }
      onDone()
    } catch (err) { toast(explain(err)) }
    setBusy(false)
  }
  const del = async () => {
    try { await categories.adminDeleteBaseCat(code, c.id); toast('지웠어요. 이미 추가한 사람의 활동은 남아 있어요.'); onDone() } catch (err) { toast(explain(err)) }
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
          <input className="inp" name="name" defaultValue={c?.name || ''} maxLength={12} placeholder="활동 이름" aria-label="이름" required />
          <input className="inp" name="subtitle" defaultValue={c?.subtitle || ''} maxLength={20} placeholder="부제 (선택, 예: 드라마)" aria-label="부제" title="활동 페이지 제목 옆에 작게 보여요" style={{ flex: '0 0 130px' }} />
          <select className="inp" name="color" defaultValue={c?.color || 'c1'} aria-label="색">
            {COLORS.map((k, i) => <option key={k} value={k}>색 {i + 1}</option>)}
          </select>
          <input className="inp" name="sort" type="number" defaultValue={c?.sort ?? 0} aria-label="순서" title="작을수록 앞" style={{ flex: '0 0 70px' }} />
          <select className="inp" name="kind" defaultValue={c?.kind || 'default'} aria-label="활동 페이지" title="활동을 눌렀을 때 나오는 페이지">
            <option value="default">페이지: 기본</option>
            <option value="ledger">페이지: 가계부</option>
            <option value="reading">페이지: 독서</option>
            <option value="workout">페이지: 운동</option>
            <option value="media">페이지: 영화·드라마</option>
          </select>
        </div>
        {file && (
          <div className="row">
            <label className="toggle"><input type="checkbox" checked={cut} onChange={e => setCut(e.target.checked)} /> 배경 자동 제거</label>
            {cut && <label className="toggle">강도 <input type="range" min={5} max={80} value={tol} onChange={e => setTol(+e.target.value)} /></label>} <Help>배경이 덜 지워지면 강도를 올리고, 그림이 같이 지워지면 내려 주세요.</Help>
          </div>
        )}
        <OptionsEditor opts={opts} setOpts={setOpts} toast={toast} />
        <div className="row">
          <button className="btn pri sm" disabled={busy}>{c ? '저장' : '추가'}</button>
          {c && <ConfirmX onConfirm={del} label="삭제" className="btn sm warn" />}
        </div>
      </div>
    </form>
  )
}

/* 테스트 모드: 템플릿을 실제 내 활동과 상관없이 열어 본다. 진도·점수는 이 브라우저에만 저장. */
const testKey = id => 'godsaeng-plan-test-' + id
const readTest = id => { try { return JSON.parse(localStorage.getItem(testKey(id))) || {} } catch { return {} } }
const writeTest = (id, v) => { try { localStorage.setItem(testKey(id), JSON.stringify(v)) } catch { /* 저장 못 해도 화면은 동작 */ } }

function PlanTest({ code, toast }) {
  const { S } = useStore()
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(null)       // { id, tpl }
  const [pg, setPg] = useState({})
  useEffect(() => { plans.adminListPlans(code).then(setList).catch(e => toast(explain(e))) }, [code, toast])
  const start = async id => {
    try { setOpen({ id, tpl: await plans.adminGetPlan(code, id) }); setPg(readTest(id)) } catch (e) { toast(explain(e)) }
  }
  const save = v => { setPg(v); writeTest(open.id, v) }
  return (
    <>
      <Fold head={<><span>플랜 템플릿</span><Help>활동에 붙일 공부 플랜이에요. 테스트 모드는 실제 내 활동이 아니라서, 진도와 점수가 이 브라우저에만 저장되고 다른 사람에게 보이지 않아요.</Help></>}>
      {!list ? <p className="empty">불러오는 중…</p> : list.length ? list.map(t => (
        <div className="person" key={t.id}>
          <div className="nm" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}><b>{t.title}</b><small className="sub">{t.days}일 · {t.summary}</small></div>
          <button className="btn sm pri" onClick={() => start(t.id)}>테스트 모드로 열기</button>
        </div>
      )) : <p className="empty">아직 올라온 템플릿이 없어요.</p>}
      {open && (
        <Modal wide title="테스트 모드" onClose={() => setOpen(null)}>
          <div className="note row between">
            <span>🧪 테스트 모드예요. 내 활동에 저장되지 않고, 진도·점수는 이 브라우저에만 남아요.</span>
            <ConfirmX onConfirm={() => save({})} label="진도 초기화" className="btn sm" />
          </div>
          <PlanViewer tpl={open.tpl} progress={pg} setProgress={save}
            people={[{ id: 'test', nick: (S.me?.nick || '나') + ' (테스트)', ava: S.me ? avaOf(S, S.uid) : '🧪', progress: pg }]}
            onSave={async data => { try { await plans.adminSavePlan(code, open.id, data); setOpen({ ...open, tpl: data }); toast('템플릿을 저장했어요.') } catch (e) { toast(explain(e)); throw e } }} />
        </Modal>
      )}
    </Fold>
    </>
  )
}

/* 챌린지 관리: 템플릿 + 연결할 추천 활동(하위 선택지)을 고른다. 아직은 관리자만 만든다. */
function QuestForm({ q, code, baseCats, plansList, onDone, toast }) {
  const [baseId, setBaseId] = useState(q?.baseId || '')
  const base = baseCats.find(b => b.id === baseId)
  const save = async e => {
    const form = e.currentTarget, v = formVals(e)
    if (!v.title) return
    try {
      await questApi.adminSaveQuest(code, { id: q?.id, title: v.title, description: v.description, templateId: v.templateId, baseId, optionId: v.optionId, sort: +v.sort || 0 })
      toast(q ? '챌린지를 저장했어요.' : '챌린지를 만들었어요.'); if (!q) { form.reset(); setBaseId('') }
      onDone()
    } catch (err) { toast(explain(err)) }
  }
  return (
    <form className="basecat" onSubmit={save} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="addf">
        <input className="inp" name="title" defaultValue={q?.title || ''} maxLength={40} placeholder="챌린지 이름 (예: 12주 챌린지)" aria-label="챌린지 이름" required />
        <input className="inp" name="sort" type="number" defaultValue={q?.sort ?? 0} aria-label="순서" style={{ flex: '0 0 70px' }} />
      </div>
      <textarea className="inp" name="description" rows={2} defaultValue={q?.description || ''} placeholder="간단한 설명 (챌린지 화면 맨 위에 보여요)" aria-label="설명" />
      <div className="addf">
        <select className="inp" name="templateId" defaultValue={q?.templateId || ''} aria-label="플랜 템플릿" style={{ maxWidth: 'none' }}>
          <option value="">플랜 템플릿 고르기</option>
          {plansList.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select className="inp" value={baseId} onChange={e => setBaseId(e.target.value)} aria-label="연결할 추천 활동" style={{ maxWidth: 'none' }}>
          <option value="">연결할 추천 활동</option>
          {baseCats.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {base?.options?.length > 0 && (
          <select className="inp" name="optionId" defaultValue={q?.optionId || ''} key={baseId} aria-label="하위 선택지" style={{ maxWidth: 'none' }}>
            <option value="">(하위 선택지 없음)</option>
            {base.options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
      </div>
      <div className="row">
        <button className="btn pri sm">{q ? '저장' : '챌린지 만들기'}</button>
        {q && <ConfirmX onConfirm={async () => { try { await questApi.adminDeleteQuest(code, q.id); toast('챌린지를 지웠어요.'); onDone() } catch (err) { toast(explain(err)) } }} label="삭제" className="btn sm warn" />}
      </div>
    </form>
  )
}

function AdminQuests({ code, baseCats, toast, refresh }) {
  const [list, setList] = useState(null), [plansList, setPlans] = useState([])
  const load = () => Promise.all([questApi.adminListQuests(code), plans.adminListPlans(code)]).then(([q, p]) => { setList(q); setPlans(p) }).catch(e => toast(explain(e)))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [code])
  const done = () => { load(); refresh() }
  return (
    <>
      <Fold head={<><span>챌린지</span><Help>플랜 템플릿을 여러 사람이 함께 하는 챌린지예요. 연결한 추천 활동(예: 언어 → 일본어) 옆에 보이고, 참여하면 그 활동이 참여자 활동에 담겨요.</Help></>}>
      {!list ? <p className="empty">불러오는 중…</p> : <div className="stack" style={{ gap: 10 }}>
        {list.map(q => <QuestForm key={q.id + q.title + q.templateId + q.baseId + q.optionId + q.sort + q.description} q={q} code={code} baseCats={baseCats} plansList={plansList} onDone={done} toast={toast} />)}
        <QuestForm code={code} baseCats={baseCats} plansList={plansList} onDone={done} toast={toast} />
      </div>}
    </Fold>
    </>
  )
}

/* 백업: 버튼 한 번으로 전체 데이터를 JSON 파일로 내려받는다. 마지막으로 받은 날은 이 브라우저에 기억. */
const BK_KEY = 'godsaeng-last-backup'
function Backup({ code, toast }) {
  const [last, setLast] = useState(() => { try { return localStorage.getItem(BK_KEY) || '' } catch { return '' } })
  const [busy, setBusy] = useState(false)
  const days = last ? Math.floor((Date.now() - new Date(last)) / 864e5) : null
  const run = async () => {
    setBusy(true)
    try {
      const data = await admin.backup(code)
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
      const a = document.createElement('a'), d = new Date()
      a.href = URL.createObjectURL(blob)
      a.download = `godsaeng-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      const now = d.toISOString(); setLast(now); try { localStorage.setItem(BK_KEY, now) } catch { /* 무시 */ }
      toast('백업 파일을 내려받았어요.')
    } catch (err) { toast(explain(err)) }
    setBusy(false)
  }
  return (
    <>
      <Fold head={<><span>데이터 백업</span><Help>갓생홈피의 모든 기록(프로필·루틴·투두·일기·일정·활동·챌린지 진도·템플릿)을 파일 하나로 내려받아요. 로그인 비밀번호와 입장·관리자 코드는 들어가지 않아요. 이 파일이 있으면 문제가 생겨도 되살릴 수 있어요.</Help></>}>
      <div className="row">
        <button className="btn pri sm" disabled={busy} onClick={run}>{busy ? '만드는 중…' : '💾 백업 파일 내려받기'}</button>
        <span className="sub">{last ? `마지막 백업: ${localDateTime(last)} (${days}일 전)` : '아직 이 브라우저에서 백업한 적이 없어요.'}</span>
        {days !== null && days >= 7 && <span className="pill">백업할 때가 됐어요</span>}
      </div>
    </Fold>
    </>
  )
}

/* 화면 설정 (계정마다 저장): 배경 색·무늬·이미지, 제목 형광펜 색·모양 */
const BG_COLORS = ['#EEF1F6', '#FFF8EC', '#FDEFF4', '#EEF7EF', '#EAF4FB', '#F2EEFB', '#F4F1EA', '#FFFFFF']
const MARK_COLORS = ['#FFD84D', '#FFB3C7', '#A8E6CF', '#A7D8FF', '#D7C4FF', '#FFC59E', '#E0E0E0']
const PATS = [['grid', '모눈'], ['dots', '도트'], ['lines', '줄'], ['check', '체크'], ['plain', '민무늬']]
const MARKS = [['pen', '형광펜'], ['line', '밑줄'], ['box', '배경'], ['none', '없음']]

function Display() {
  const { S, act } = useStore()
  const ui = S.ui || {}
  const set = patch => act.setUi(patch)
  const upload = async f => { try { set({ image: await makeBackground(f) }) } catch (e) { act.toast(e.message) } }
  return (
    <section className="sheet">
      <h2><span>화면 설정</span><Help>배경과 제목 형광펜을 바꿔요. 내 계정에만 적용되고, 다른 기기에서 로그인해도 그대로예요.</Help></h2>
      {S.uid && !S.local && S.ui === undefined && <p className="sub">화면 설정 저장 준비 중이에요. 바꾼 내용은 지금 화면에만 보여요.</p>}
      <div className="set-row"><span className="sub">배경 색</span>
        {BG_COLORS.map(c => <button key={c} className={'swatch big' + ((ui.bg || '') === c ? ' on' : '')} style={{ background: c }} aria-label={c} onClick={() => set({ bg: c })} />)}
        <input type="color" value={ui.bg || '#EEF1F6'} onChange={e => set({ bg: e.target.value })} aria-label="다른 배경 색" />
      </div>
      <div className="set-row"><span className="sub">배경 무늬</span>
        {PATS.map(([k, l]) => <button key={k} className={'btn sm' + ((ui.pattern || 'grid') === k ? ' hl' : '')} onClick={() => set({ pattern: k })}>{l}</button>)}
      </div>
      <div className="set-row"><span className="sub">배경 이미지</span>
        <label className="btn sm">{ui.image ? '이미지 바꾸기' : '이미지 올리기'}<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} /></label>
        {ui.image && <><img className="bg-thumb" src={ui.image} alt="" /><button className="x" onClick={() => set({ image: '' })}>이미지 빼기</button></>}
        <Help>이미지를 올리면 배경 색·무늬 대신 이미지가 화면 뒤에 깔려요.</Help>
      </div>
      <div className="set-row"><span className="sub">제목 표시</span>
        {MARKS.map(([k, l]) => <button key={k} className={'btn sm' + ((ui.markStyle || 'pen') === k ? ' hl' : '')} onClick={() => set({ markStyle: k })}>{l}</button>)}
      </div>
      <div className="set-row"><span className="sub">표시 색</span>
        {MARK_COLORS.map(c => <button key={c} className={'swatch big' + ((ui.mark || '') === c ? ' on' : '')} style={{ background: c }} aria-label={c} onClick={() => set({ mark: c })} />)}
        <input type="color" value={ui.mark || '#FFD84D'} onChange={e => set({ mark: e.target.value })} aria-label="다른 표시 색" />
      </div>
      {(S.site?.cursors || []).length > 0 && (
        <div className="set-row"><span className="sub">커서</span>
          <button className={'btn sm' + (!ui.cursor ? ' hl' : '')} onClick={() => set({ cursor: '' })}>기본</button>
          {S.site.cursors.map(c => <button key={c.id} className={'btn sm cursor-opt' + (ui.cursor === c.id ? ' hl' : '')} onClick={() => set({ cursor: c.id })} title={c.name}><img src={c.image} alt="" />{c.name}</button>)}
        </div>
      )}
      <div className="row"><ConfirmX onConfirm={() => set({ bg: '', pattern: '', image: '', mark: '', markStyle: '', cursor: '' })} label="기본으로 되돌리기" className="btn sm" /></div>
    </section>
  )
}

/* 책 표지 요청: 북 컬렉션에 제목만 넣은 책 목록. 표지를 올리면 그 사람 컬렉션에 바로 들어간다. */
function BookRequests({ code, toast }) {
  const [list, setList] = useState(null)
  const load = () => bookApi.adminBookRequests(code).then(setList).catch(e => { setList([]); toast(explain(e)) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [code])
  const upload = async (b, f) => {
    try { await bookApi.adminBookCover(code, b.id, await makeCover(f)); toast(`「${b.title}」 표지를 넣었어요.`); load() } catch (e) { toast(explain(e)) }
  }
  return (
    <>
      <Fold head={<><span>표지·포스터 요청</span><Help>북 컬렉션·영화 컬렉션에 표지 없이 담긴 것들이에요. 사진을 올리면 그 사람 컬렉션에 바로 보여요.</Help></>}>
      {!list ? <p className="empty">불러오는 중…</p> : list.length ? list.map(b => (
        <div className="person" key={b.id}>
          <div className="nm" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            <b>{b.title}</b><small className="sub">{b.author ? b.author + ' · ' : ''}{b.nick} · {localDateTime(b.created_at)}</small>
          </div>
          <label className="btn sm pri">표지 올리기<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(b, f) }} /></label>
        </div>
      )) : <p className="empty">표지를 기다리는 책이 없어요.</p>}
    </Fold>
    </>
  )
}

/* 사이트 설정(관리자): 위블 계정·아이콘·링크 / 커서 / 스티커 */
const WEBLE_LINK = 'https://docs.google.com/spreadsheets/d/1IuPozT0O302lXJMqeau_J3iKW2qK-fx5sBxQU8h1Wd8/edit?usp=sharing'
const sid = () => Math.random().toString(36).slice(2, 9)

function SiteAdmin({ code, accounts, toast, refresh }) {
  const [site, setSite] = useState(null)
  const [pieces, setPieces] = useState([])   // 스티커 시트에서 찾은 조각 [{ img, on }]
  const [cut, setCut] = useState(true)
  const [sheet, setSheet] = useState(null)   // 스티커 시트 파일
  const [sOpt, setSOpt] = useState({ cutout: true, tolerance: 28, outline: 0, gap: 0 })
  const [editing, setEditing] = useState(null)  // 손질 중인 조각 번호
  const [busy, setBusy] = useState(false)
  // 시트나 옵션이 바뀌면 다시 자른다
  useEffect(() => {
    if (!sheet) return
    let live = true
    setBusy(true)
    splitStickers(sheet, sOpt).then(imgs => { if (!live) return; setPieces(imgs.map(x => ({ ...x, on: true }))); if (!imgs.length) toast('스티커를 찾지 못했어요. 강도를 바꾸거나 배경 제거를 꺼 보세요.') })
      .catch(e => toast(e.message)).finally(() => live && setBusy(false))
    return () => { live = false }
  }, [sheet, sOpt, toast])
  const load = () => siteApi.adminLoadSite(code).then(setSite).catch(e => { setSite({}); toast(explain(e)) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [code])
  if (!site) return <p className="empty">불러오는 중…</p>
  const weble = { users: [], icon: '', link: WEBLE_LINK, ...site.weble }
  const cursors = site.cursors || [], stickers = site.stickers || []
  const save = async (key, value, msg) => {
    try { await siteApi.adminSetSite(code, key, value); setSite({ ...site, [key]: value }); refresh(); if (msg) toast(msg) } catch (e) { toast(explain(e)) }
  }
  const file = (fn) => e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fn(f).catch(err => toast(err.message)) }

  return <>
    <Fold head={<><span>위블</span><Help>위블로 지정한 계정에게만 화면 왼쪽 위에 아이콘이 보이고, 누르면 링크로 이동해요.</Help></>}>
    <div className="set-row"><span className="sub">아이콘</span>
      <span className="checker sm">{weble.icon ? <img src={weble.icon} alt="" /> : '🔗'}</span>
      <label className="btn sm">이미지 올리기<input type="file" accept="image/*" hidden onChange={file(async f => save('weble', { ...weble, icon: await makeIcon(f, { cutout: true }) }, '위블 아이콘을 바꿨어요.'))} /></label>
      {weble.icon && <button className="x" onClick={() => save('weble', { ...weble, icon: '' })}>빼기</button>}
    </div>
    <div className="set-row"><span className="sub">링크</span>
      <input className="inp" defaultValue={weble.link} key={weble.link} onBlur={e => e.target.value !== weble.link && save('weble', { ...weble, link: e.target.value.trim() }, '링크를 바꿨어요.')} aria-label="위블 링크" />
    </div>
    <div className="set-row"><span className="sub">위블 계정</span>
      {(accounts || []).length ? accounts.map(a => {
        const on = weble.users.includes(a.id)
        return <button key={a.id} className={'btn sm' + (on ? ' hl' : '')} onClick={() => save('weble', { ...weble, users: on ? weble.users.filter(x => x !== a.id) : [...weble.users, a.id] })}>{on ? '✓ ' : ''}{a.nick}</button>
      }) : <span className="sub">계정이 없어요.</span>}
    </div>

    </Fold>
    <Fold head={<><span>커서</span><Help>.cur 파일은 그대로(클릭 지점 포함) 쓰고, 일반 이미지는 배경을 지우고 40px 로 줄여요. 올린 커서는 모두가 화면 설정에서 골라 쓸 수 있어요. 움직이는 커서(.ani)는 브라우저가 지원하지 않아요.</Help></>}>
    <div className="set-row">
      <label className="toggle"><input type="checkbox" checked={cut} onChange={e => setCut(e.target.checked)} /> 배경 자동 제거</label>
      <label className="btn sm pri">커서 올리기 (.cur · 이미지)<input type="file" accept=".cur,.ico,image/*" hidden onChange={file(async f => {
        const name = f.name.replace(/\.[^.]+$/, '').slice(0, 12)
        // .cur·.ico 는 그림과 클릭 지점을 그대로 살리고, 일반 이미지는 (선택) 배경 제거 후 40px
        const cur = /\.(cur|ico)$/i.test(f.name) ? await readCur(f) : { image: await makeCursor(f, { cutout: cut }), hx: 2, hy: 2 }
        await save('cursors', [...cursors, { id: sid(), name, image: cur.image, hx: cur.hx, hy: cur.hy }], '커서를 추가했어요.')
      })} /></label>
    </div>
    <div className="row">{cursors.map(c => (
      <span key={c.id} className="chip"><img src={c.image} alt="" style={{ width: 24, height: 24 }} />{c.name}
        <ConfirmX onConfirm={() => save('cursors', cursors.filter(x => x.id !== c.id))} /></span>
    ))}</div>

    </Fold>
    <Fold head={<><span>스티커</span><Help>스티커 여러 개가 한 장에 있는 이미지를 올리면 배경을 지우고 하나씩 잘라 줘요. 강도·흰 테두리를 바꾸면 바로 다시 잘라 보여 줘요. 배경이 투명한 PNG 시트라면 배경 제거를 끄는 게 가장 깔끔해요.</Help></>}>
    <div className="set-row">
      <label className="btn sm pri">스티커 시트 올리기<input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setSheet(f) }} /></label>
      {sheet && <span className="sub">{sheet.name}</span>}
    </div>
    {sheet && (
      <div className="set-row">
        <label className="toggle"><input type="checkbox" checked={sOpt.cutout} onChange={e => setSOpt({ ...sOpt, cutout: e.target.checked })} /> 배경 제거</label>
        {sOpt.cutout && <label className="toggle">강도 <input type="range" min={5} max={90} value={sOpt.tolerance} onChange={e => setSOpt({ ...sOpt, tolerance: +e.target.value })} /> {sOpt.tolerance}</label>}
        {sOpt.cutout && <label className="toggle">틈 메우기 <input type="range" min={0} max={8} value={sOpt.gap} onChange={e => setSOpt({ ...sOpt, gap: +e.target.value })} /> {sOpt.gap}px <Help>캐릭터 선이 끊겨 있어서 몸통 색까지 지워질 때 올려 보세요. 끊긴 틈을 막고 배경만 지워요.</Help></label>}
        <label className="toggle">흰 테두리 <input type="range" min={0} max={8} value={sOpt.outline} onChange={e => setSOpt({ ...sOpt, outline: +e.target.value })} /> {sOpt.outline}px</label>
      </div>
    )}
    {busy && <p className="sub">자르는 중…</p>}
    {pieces.length > 0 && <>
      <p className="sub">{pieces.length}개를 찾았어요. 눌러서 쓸 것만 남기고, ✎ 로 이상한 부분을 붓으로 손질할 수 있어요. (옵션을 바꾸면 손질한 것은 처음으로 돌아가요)</p>
      <div className="sticker-grid">{pieces.map((p, i) => (
        <span key={i} className={'sticker-pick' + (p.on ? ' on' : '')} onClick={() => setPieces(pieces.map((x, j) => j === i ? { ...x, on: !x.on } : x))}>
          <img src={p.img} alt="" />
          <button className="btn sm edit-dot" title="손질" onClick={e => { e.stopPropagation(); setEditing(i) }}>✎</button>
        </span>
      ))}</div>
      {editing !== null && pieces[editing] && (
        <StickerEditor cut={pieces[editing].cut} orig={pieces[editing].orig} onClose={() => setEditing(null)}
          onSave={async cut => { const img = await finishSticker(cut, sOpt.outline); setPieces(pieces.map((x, j) => j === editing ? { ...x, cut, img } : x)); setEditing(null) }} />
      )}
      <div className="row">
        <button className="btn pri sm" onClick={async () => { await save('stickers', [...stickers, ...pieces.filter(p => p.on).map(p => ({ id: sid(), image: p.img }))], '스티커를 추가했어요.'); setPieces([]); setSheet(null) }}>골라진 {pieces.filter(p => p.on).length}개 추가</button>
        <button className="btn sm" onClick={() => { setPieces([]); setSheet(null) }}>취소</button>
      </div>
    </>}
    <div className="sticker-grid">{stickers.map(st => (
      <span key={st.id} className="sticker-pick on"><img src={st.image} alt="" /><ConfirmX onConfirm={() => save('stickers', stickers.filter(x => x.id !== st.id))} /></span>
    ))}</div>
    </Fold>
  </>
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
      <Display />

      {S.uid && !S.local && (
        <section className="sheet">
          <h2><span>계정</span></h2>
          <div className="row">
            <span>{S.me?.nick}{S.me?.handle ? ` (${S.me.handle})` : ''}</span>
            <button className="btn sm" onClick={act.signOut}>로그아웃</button>
          </div>
        </section>
      )}

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
            <Fold head={<><span>계정</span><small className="sub"> {list.length}개</small><Help>아이디·닉네임·비밀번호를 바꾸거나 계정을 지울 수 있어요. 지운 계정의 기록은 되살릴 수 없어요.</Help></>}>
            <div>
              {list.length ? list.map(a => (
                <AccountRow key={a.id} a={a} code={code} toast={act.toast} onDone={() => { load(code); act.refresh() }} />
              )) : <p className="empty">아직 가입한 계정이 없어요.</p>}
            </div>
            </Fold>
            <Fold head={<><span>기본 활동</span><Help>모두에게 보이는 기본 활동이에요. 각자 활동 탭에서 골라 추가해요. 이미지를 올리면 이모지 대신 이미지가 아이콘이 돼요. 순서는 숫자가 작을수록 앞이에요.</Help></>}>
            <div className="stack" style={{ gap: 10 }}>
              {baseCats.map(c => <BaseCatForm key={c.id + c.name + c.icon + c.color + c.sort + c.kind + c.subtitle + c.image.length + JSON.stringify(c.options).length} c={c} code={code} toast={act.toast} onDone={() => { load(code); act.refresh() }} />)}
              <BaseCatForm code={code} toast={act.toast} onDone={() => { load(code); act.refresh() }} />
            </div>
            </Fold>
            <Backup code={code} toast={act.toast} />
            <SiteAdmin code={code} accounts={list} toast={act.toast} refresh={act.refresh} />
            <BookRequests code={code} toast={act.toast} />
            <AdminQuests code={code} baseCats={baseCats} toast={act.toast} refresh={act.refresh} />
            <PlanTest code={code} toast={act.toast} />
          </>}
      </section>
    </div>
  )
}
