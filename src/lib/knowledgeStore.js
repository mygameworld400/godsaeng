import { useCallback, useEffect, useState } from 'react'

/* 지식 개인 기록 (출석·저장·노트·최근 본 지식·퀴즈 푼 기록). 지금은 브라우저 localStorage 에 계정별로 저장한다.
   key: godsaeng-know-<uid>
   형식: { attendance: { 'YYYY-MM-DD': true }, saved: { 지식id: 저장한ISO }, notes: [{ id, title, body, tags[], relatedId, updatedAt }], recent: [지식id...], quiz: { 퀴즈id: 고른 번호 } }
   나중에 DB 로 옮길 때는 load / persist 두 함수만 Supabase 호출로 바꾸면 된다 (useKnowledgeStore 의 반환값은 그대로). */

const EMPTY = { attendance: {}, saved: {}, notes: [], recent: [], quiz: {} }
const keyOf = uid => 'godsaeng-know-' + (uid || 'guest')

function load(uid) {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(keyOf(uid)) || '{}') } } catch { return { ...EMPTY } }
}
function persist(uid, data) {
  try { localStorage.setItem(keyOf(uid), JSON.stringify(data)) } catch { /* 저장 공간 부족 등: 화면은 계속 동작 */ }
}

export function useKnowledgeStore(uid) {
  const [data, setData] = useState(() => load(uid))
  useEffect(() => { setData(load(uid)) }, [uid])
  const update = useCallback(fn => setData(prev => { const next = fn(prev); persist(uid, next); return next }), [uid])

  return {
    ...data,
    markAttend: date => update(d => ({ ...d, attendance: { ...d.attendance, [date]: true } })),
    unmarkAttend: date => update(d => { const a = { ...d.attendance }; delete a[date]; return { ...d, attendance: a } }),
    toggleSave: id => update(d => { const s = { ...d.saved }; if (s[id]) delete s[id]; else s[id] = new Date().toISOString(); return { ...d, saved: s } }),
    addRecent: id => update(d => (d.recent[0] === id ? d : { ...d, recent: [id, ...d.recent.filter(x => x !== id)].slice(0, 12) })),
    saveNote: note => update(d => {
      const n = { ...note, updatedAt: new Date().toISOString() }
      return { ...d, notes: d.notes.some(x => x.id === n.id) ? d.notes.map(x => x.id === n.id ? n : x) : [n, ...d.notes] }
    }),
    answerQuiz: (id, i) => update(d => ({ ...d, quiz: { ...d.quiz, [id]: i } })),
    resetQuiz: id => update(d => { const q = { ...d.quiz }; delete q[id]; return { ...d, quiz: q } }),
    deleteNote: id => update(d => ({ ...d, notes: d.notes.filter(x => x.id !== id) })),
  }
}
