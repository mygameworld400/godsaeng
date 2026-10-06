import { hasServer, supabase, unwrap } from '../lib/supabase'
import { KNOWLEDGE } from '../data/knowledge'

/* 지식 페이지 데이터 (025 마이그레이션)
   gs_knowledge     지식 글 (관리자만 쓰기)          gs_know_marks    형광펜 설명 (모두)
   gs_know_posts    공유 지식·뉴스 게시판 (모두)      gs_know_comments 댓글 (모두)
   gs_know_quizzes  지식 퀴즈 (관리자만 쓰기)
   미리보기(서버 없음)에서는 같은 모양을 브라우저 localStorage 에 흉내 낸다. */

/* ── 미리보기용 로컬 표 ── */
const LK = t => 'godsaeng-local-' + t
const lget = t => { try { return JSON.parse(localStorage.getItem(LK(t)) || 'null') } catch { return null } }
const lset = (t, rows) => { try { localStorage.setItem(LK(t), JSON.stringify(rows)) } catch { /* 공간 부족 */ } }
const lrows = t => lget(t) || (t === 'gs_knowledge' ? KNOWLEDGE.map(k => ({ ...k, body: k.body.join('\n\n'), key_points: k.keyPoints, day: k.date || null })) : [])
const lid = () => crypto.randomUUID?.() || String(Date.now()) + Math.random()
const now = () => new Date().toISOString()

/* ── 지식 글 ── */
export const toKnow = r => ({
  id: r.id, day: r.day || null, category: r.category, title: r.title, summary: r.summary || '',
  body: (r.body || '').split(/\n\s*\n/).map(s => s.trim()).filter(Boolean), bodyText: r.body || '',
  keyPoints: r.key_points || [], tags: r.tags || [], minutes: r.minutes || 2, image: r.image,
})
const LIST_COLS = 'id,day,category,title,summary,body,key_points,tags,minutes'

export async function listKnowledge() {
  if (!hasServer) return lrows('gs_knowledge').map(r => toKnow({ ...r, image: undefined }))
  return unwrap(await supabase.from('gs_knowledge').select(LIST_COLS).order('day', { ascending: false, nullsFirst: false }).order('created_at')).map(toKnow)
}
/** 대표 이미지는 목록에서 빼고 글을 열 때만 받는다 */
export async function knowledgeImage(id) {
  if (!hasServer) return lrows('gs_knowledge').find(r => r.id === id)?.image || null
  return unwrap(await supabase.from('gs_knowledge').select('image').eq('id', id).maybeSingle())?.image || null
}
const fromKnow = k => ({ day: k.day || '', category: k.category, title: k.title, summary: k.summary, body: k.bodyText, key_points: k.keyPoints, tags: k.tags, image: k.image || '', minutes: k.minutes })
export async function adminSaveKnowledge(code, k) {
  if (!hasServer) {
    const rows = lrows('gs_knowledge'), row = { ...fromKnow(k), day: k.day || null, image: k.image || null }
    if (k.day && rows.some(r => r.day === k.day && r.id !== k.id)) throw new Error('duplicate key')
    const id = k.id || lid()
    lset('gs_knowledge', k.id ? rows.map(r => r.id === k.id ? { ...r, ...row } : r) : [...rows, { id, ...row }])
    return id
  }
  return unwrap(await supabase.rpc('gs_admin_knowledge_save', { p_code: code, p_id: k.id || null, p_row: fromKnow(k) }))
}
export async function adminDeleteKnowledge(code, id) {
  if (!hasServer) return lset('gs_knowledge', lrows('gs_knowledge').filter(r => r.id !== id))
  unwrap(await supabase.rpc('gs_admin_knowledge_delete', { p_code: code, p_id: id }))
}
export async function adminCheck(code) {
  if (!hasServer) return
  unwrap(await supabase.rpc('gs_admin_check', { p_code: code }))
}

/* ── 형광펜 설명 ── */
const toMark = r => ({ id: r.id, knowledgeId: r.knowledge_id, userId: r.user_id, para: r.para, start: r.start, len: r.len, quote: r.quote, color: r.color, note: r.note, createdAt: r.created_at })
export async function listMarks(knowledgeId) {
  if (!hasServer) return lrows('gs_know_marks').filter(r => r.knowledge_id === knowledgeId).map(toMark)
  return unwrap(await supabase.from('gs_know_marks').select('*').eq('knowledge_id', knowledgeId).order('created_at')).map(toMark)
}
export async function addMark(uid, m) {
  const row = { knowledge_id: m.knowledgeId, user_id: uid, para: m.para, start: m.start, len: m.len, quote: m.quote, color: m.color, note: m.note }
  if (!hasServer) { const r = { id: lid(), created_at: now(), ...row }; lset('gs_know_marks', [...lrows('gs_know_marks'), r]); return toMark(r) }
  return toMark(unwrap(await supabase.from('gs_know_marks').insert(row).select().single()))
}
export async function deleteMark(id, code) {
  if (!hasServer) return lset('gs_know_marks', lrows('gs_know_marks').filter(r => r.id !== id))
  if (code) unwrap(await supabase.rpc('gs_admin_know_delete', { p_code: code, p_kind: 'mark', p_id: id }))
  else unwrap(await supabase.from('gs_know_marks').delete().eq('id', id))
}

/* ── 공유 지식·뉴스 게시판 ── */
const toPost = r => ({
  id: r.id, userId: r.user_id, kind: r.kind, category: r.category || '', title: r.title, body: r.body || '', url: r.url || '', source: r.source || '',
  image: r.image, hasImage: r.image !== undefined ? !!r.image : !!r.has_image, createdAt: r.created_at, updatedAt: r.updated_at,
  comments: r.gs_know_comments?.[0]?.count ?? r.comments ?? 0,
})
export async function listPosts(kind) {
  if (!hasServer) {
    const cs = lrows('gs_know_comments')
    return lrows('gs_know_posts').filter(r => r.kind === kind).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .map(r => toPost({ ...r, image: undefined, has_image: !!r.image, comments: cs.filter(c => c.post_id === r.id).length }))
  }
  return unwrap(await supabase.from('gs_know_posts').select('id,user_id,kind,category,title,body,url,source,created_at,updated_at,gs_know_comments(count)')
    .eq('kind', kind).order('created_at', { ascending: false }).limit(300)).map(toPost)
}
export async function getPost(id) {
  if (!hasServer) { const r = lrows('gs_know_posts').find(x => x.id === id); return r ? toPost(r) : null }
  const r = unwrap(await supabase.from('gs_know_posts').select('*').eq('id', id).maybeSingle())
  return r ? toPost(r) : null
}
export async function savePost(uid, p) {
  const row = { kind: p.kind, category: p.category || '', title: p.title, body: p.body || '', url: p.url || '', source: p.source || '', image: p.image || null }
  if (!hasServer) {
    const rows = lrows('gs_know_posts')
    if (p.id) { lset('gs_know_posts', rows.map(r => r.id === p.id ? { ...r, ...row, updated_at: now() } : r)); return p.id }
    const id = lid(); lset('gs_know_posts', [{ id, user_id: uid, created_at: now(), updated_at: now(), ...row }, ...rows]); return id
  }
  if (p.id) { unwrap(await supabase.from('gs_know_posts').update({ ...row, updated_at: now() }).eq('id', p.id)); return p.id }
  return unwrap(await supabase.from('gs_know_posts').insert({ ...row, user_id: uid }).select('id').single()).id
}
export async function deletePost(id, code) {
  if (!hasServer) { lset('gs_know_posts', lrows('gs_know_posts').filter(r => r.id !== id)); return lset('gs_know_comments', lrows('gs_know_comments').filter(r => r.post_id !== id)) }
  if (code) unwrap(await supabase.rpc('gs_admin_know_delete', { p_code: code, p_kind: 'post', p_id: id }))
  else unwrap(await supabase.from('gs_know_posts').delete().eq('id', id))
}

const toComment = r => ({ id: r.id, postId: r.post_id, userId: r.user_id, body: r.body, createdAt: r.created_at })
export async function listComments(postId) {
  if (!hasServer) return lrows('gs_know_comments').filter(r => r.post_id === postId).map(toComment)
  return unwrap(await supabase.from('gs_know_comments').select('*').eq('post_id', postId).order('created_at')).map(toComment)
}
export async function addComment(uid, postId, body) {
  const row = { post_id: postId, user_id: uid, body }
  if (!hasServer) return lset('gs_know_comments', [...lrows('gs_know_comments'), { id: lid(), created_at: now(), ...row }])
  unwrap(await supabase.from('gs_know_comments').insert(row))
}
export async function deleteComment(id, code) {
  if (!hasServer) return lset('gs_know_comments', lrows('gs_know_comments').filter(r => r.id !== id))
  if (code) unwrap(await supabase.rpc('gs_admin_know_delete', { p_code: code, p_kind: 'comment', p_id: id }))
  else unwrap(await supabase.from('gs_know_comments').delete().eq('id', id))
}

/* ── 지식 퀴즈 ── */
const toQuiz = r => ({ id: r.id, question: r.question, choices: r.choices, answer: r.answer, explanation: r.explanation || '', sort: r.sort || 0 })
const bySort = (a, b) => a.sort - b.sort || (a.created_at < b.created_at ? -1 : 1)
export async function listQuizzes() {
  if (!hasServer) return lrows('gs_know_quizzes').sort(bySort).map(toQuiz)
  return unwrap(await supabase.from('gs_know_quizzes').select('*').order('sort').order('created_at')).map(toQuiz)
}
export async function adminSaveQuiz(code, q) {
  if (!hasServer) {
    const rows = lrows('gs_know_quizzes'), row = { question: q.question, choices: q.choices, answer: q.answer, explanation: q.explanation, sort: q.sort }
    lset('gs_know_quizzes', q.id ? rows.map(r => r.id === q.id ? { ...r, ...row } : r) : [...rows, { id: lid(), created_at: now(), ...row }]); return
  }
  unwrap(await supabase.rpc('gs_admin_quiz_save', { p_code: code, p_id: q.id || null, p_question: q.question, p_choices: q.choices, p_answer: q.answer, p_explanation: q.explanation, p_sort: q.sort }))
}
export async function adminDeleteQuiz(code, id) {
  if (!hasServer) return lset('gs_know_quizzes', lrows('gs_know_quizzes').filter(r => r.id !== id))
  unwrap(await supabase.rpc('gs_admin_quiz_delete', { p_code: code, p_id: id }))
}
