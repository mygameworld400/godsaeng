import { useEffect, useState } from 'react'
import * as api from '../../services/knowledgeService'
import { makeBackground } from '../../lib/cutout'
import { CATEGORIES } from '../../data/knowledge'
import { ConfirmX } from '../common'
import { dotDate } from './parts'

/* 공유 지식(share) · 뉴스 스크랩(news) 게시판. 모두가 읽고 쓰고 댓글을 달 수 있다. 고치기·지우기는 쓴 사람(관리자는 지우기 가능) */

const WORDS = {
  share: { title: '공유 지식', write: '+ 지식 공유하기', empty: '아직 공유된 지식이 없어요. 알게 된 걸 처음으로 나눠 보세요.', search: '공유 지식 검색' },
  news: { title: '뉴스', write: '+ 뉴스 스크랩', empty: '아직 스크랩한 뉴스가 없어요. 읽은 기사를 올려 보세요.', search: '뉴스 검색' },
}
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }

export default function KnowledgeBoard({ kind, uid, nick, adminCode, toast }) {
  const W = WORDS[kind]
  const [list, setList] = useState(null)
  const [q, setQ] = useState('')
  const [openId, setOpenId] = useState(null)
  const [edit, setEdit] = useState(null)   // 쓰는 중인 글 ({} = 새 글)
  const load = () => api.listPosts(kind).then(setList).catch(e => { setList([]); toast(e) })
  useEffect(() => { setOpenId(null); setEdit(null); setList(null); load() }, [kind])
  useEffect(() => { document.querySelector('.kn-main')?.scrollTo?.({ top: 0 }) }, [openId, edit])

  if (edit) return <PostForm kind={kind} post={edit} onCancel={() => setEdit(null)} onSaved={id => { setEdit(null); setOpenId(id); load() }} uid={uid} toast={toast} />
  if (openId) return <PostView id={openId} kind={kind} uid={uid} nick={nick} adminCode={adminCode} toast={toast}
    back={() => { setOpenId(null); load() }} onEdit={p => setEdit(p)} onDeleted={() => { setOpenId(null); load() }} />

  const t = q.trim().toLowerCase()
  const shown = (list || []).filter(p => !t || (p.title + p.body + p.source + p.category).toLowerCase().includes(t))
  return (
    <div className="kn-page">
      <div className="kn-row">
        <h2 className="kn-h2">{W.title}</h2>
        <button className="btn pri" onClick={() => setEdit({})}>{W.write}</button>
      </div>
      <input className="inp kn-search" value={q} onChange={e => setQ(e.target.value)} placeholder={W.search} aria-label={W.search} />
      {list === null ? <p className="kn-empty">불러오는 중…</p> : (
        <div className="kn-board">
          {shown.map(p => (
            <button key={p.id} className="kn-post" onClick={() => setOpenId(p.id)}>
              <span className="kn-post-t">
                {p.category && <span className="kn-cat">{p.category}</span>}
                <b>{p.title}</b>
                {p.comments > 0 && <span className="kn-cnt">[{p.comments}]</span>}
              </span>
              {kind === 'news' && p.body && <span className="kn-note-ex">{p.body}</span>}
              <span className="kn-muted">{kind === 'news' && (p.source || host(p.url)) ? (p.source || host(p.url)) + ' · ' : ''}{nick(p.userId)} · {dotDate(p.createdAt)}</span>
            </button>
          ))}
          {!shown.length && <p className="kn-empty">{list.length ? '검색 결과가 없어요.' : W.empty}</p>}
        </div>
      )}
    </div>
  )
}

function PostView({ id, kind, uid, nick, adminCode, toast, back, onEdit, onDeleted }) {
  const [p, setP] = useState(null)
  const [cs, setCs] = useState([])
  const [text, setText] = useState('')
  const loadCs = () => api.listComments(id).then(setCs).catch(toast)
  useEffect(() => { api.getPost(id).then(x => setP(x || false)).catch(e => { setP(false); toast(e) }); loadCs() }, [id])
  const send = async e => {
    e.preventDefault()
    if (!text.trim()) return
    try { await api.addComment(uid, id, text.trim()); setText(''); loadCs() } catch (err) { toast(err) }
  }
  const mine = p && p.userId === uid
  return (
    <div className="kn-page">
      <button className="kn-back" onClick={back}>‹ {WORDS[kind].title}</button>
      {p === null ? <p className="kn-empty">불러오는 중…</p> : p === false ? <p className="kn-empty">글을 찾지 못했어요. 지워졌을 수 있어요.</p> : <>
        <article className="kn-article">
          <div className="kn-meta">
            {p.category && <span className="kn-cat">{p.category}</span>}
            <span className="kn-muted">{nick(p.userId)} · {dotDate(p.createdAt)}{p.updatedAt && p.updatedAt.slice(0, 16) !== p.createdAt.slice(0, 16) ? ' (수정됨)' : ''}</span>
          </div>
          <h1 className="kn-title sm">{p.title}</h1>
          {p.url && (
            <a className="kn-newslink" href={p.url} target="_blank" rel="noopener noreferrer">
              <span>🔗 {p.source || host(p.url)}</span><small>{p.url}</small>
            </a>
          )}
          {p.image && <div className="kn-figure"><img src={p.image} alt="" /></div>}
          {p.body && <div className="kn-body pre">{p.body}</div>}
          {(mine || adminCode) && (
            <div className="kn-actions">
              {mine && <button className="btn sm" onClick={() => onEdit(p)}>고치기</button>}
              <ConfirmX label="지우기" className="btn sm warn" onConfirm={async () => { try { await api.deletePost(p.id, mine ? null : adminCode); onDeleted() } catch (e) { toast(e) } }} />
            </div>
          )}
        </article>
        <section className="kn-block">
          <h3 className="kn-h3">댓글 {cs.length}</h3>
          <div className="kn-comments">
            {cs.map(c => (
              <div key={c.id} className="kn-comment">
                <div className="kn-row">
                  <b>{nick(c.userId)}</b>
                  <span className="row" style={{ gap: 4 }}>
                    <small className="kn-muted">{dotDate(c.createdAt)}</small>
                    {(c.userId === uid || adminCode) && <ConfirmX onConfirm={async () => { try { await api.deleteComment(c.id, c.userId === uid ? null : adminCode); loadCs() } catch (e) { toast(e) } }} />}
                  </span>
                </div>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
          <form className="kn-cform" onSubmit={send}>
            <textarea className="inp" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="댓글을 남겨 보세요" maxLength={2000} aria-label="댓글" />
            <button className="btn pri" disabled={!text.trim()}>등록</button>
          </form>
        </section>
      </>}
    </div>
  )
}

function PostForm({ kind, post, uid, onCancel, onSaved, toast }) {
  const [v, setV] = useState({ title: post.title || '', body: post.body || '', url: post.url || '', source: post.source || '', category: post.category || '', image: post.image || null })
  const [busy, setBusy] = useState(false)
  const set = (k, x) => setV(o => ({ ...o, [k]: x }))
  const news = kind === 'news'
  const badUrl = v.url && !/^https?:\/\//i.test(v.url.trim())
  const pick = async f => { if (!f) return; try { set('image', await makeBackground(f)) } catch (e) { toast(e) } }
  const save = async () => {
    if (!v.title.trim() || badUrl) return
    setBusy(true)
    try { onSaved(await api.savePost(uid, { ...v, id: post.id, kind, title: v.title.trim(), url: v.url.trim(), source: v.source.trim() })) }
    catch (e) { toast(e); setBusy(false) }
  }
  return (
    <div className="kn-page kn-editor">
      <h2 className="kn-h2">{post.id ? '글 고치기' : news ? '뉴스 스크랩' : '지식 공유하기'}</h2>
      {news && <>
        <label className="kn-label">기사 링크<input className="inp" value={v.url} onChange={e => set('url', e.target.value)} placeholder="https://" inputMode="url" />{badUrl && <small className="kn-err">https:// 로 시작하는 주소를 넣어 주세요.</small>}</label>
        <label className="kn-label">언론사·출처<input className="inp" value={v.source} onChange={e => set('source', e.target.value)} placeholder="예: 연합뉴스" maxLength={60} /></label>
      </>}
      <label className="kn-label">제목<input className="inp" value={v.title} onChange={e => set('title', e.target.value)} placeholder={news ? '기사 제목' : '예: 바나나는 사실 베리류래요'} maxLength={200} /></label>
      {!news && (
        <div className="kn-label">카테고리
          <div className="kn-filters">{['', ...CATEGORIES].map(c => <button key={c || 'none'} type="button" className={'kn-chip' + (v.category === c ? ' on' : '')} onClick={() => set('category', c)}>{c || '없음'}</button>)}</div>
        </div>
      )}
      <label className="kn-label">{news ? '요약·내 생각' : '내용'}<textarea className="inp kn-textarea" rows={news ? 6 : 12} value={v.body} onChange={e => set('body', e.target.value)} placeholder={news ? '기사 핵심이나 느낀 점을 짧게 남겨 보세요' : '다른 사람들과 나누고 싶은 지식을 적어 주세요'} maxLength={10000} /></label>
      <div className="kn-label">이미지 (선택)
        <div className="row" style={{ gap: 8 }}>
          {v.image && <img className="kn-thumb" src={v.image} alt="" />}
          <label className="btn sm">{v.image ? '바꾸기' : '이미지 올리기'}<input type="file" accept="image/*" hidden onChange={e => pick(e.target.files[0])} /></label>
          {v.image && <button type="button" className="btn sm" onClick={() => set('image', null)}>빼기</button>}
        </div>
      </div>
      <div className="kn-actions">
        <button className="btn pri" onClick={save} disabled={busy || !v.title.trim() || badUrl}>{post.id ? '저장' : '올리기'}</button>
        <button className="btn" onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}
