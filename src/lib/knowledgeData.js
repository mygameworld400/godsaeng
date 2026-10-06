import { KNOWLEDGE } from '../data/knowledge'

/* 상식 콘텐츠 읽기. 지금은 mock 배열(src/data/knowledge.js)에서 읽는다.
   나중에 DB/API 를 붙일 때는 이 파일의 함수 세 개만 바꾸면 된다 (화면 쪽은 그대로). */

export function listKnowledge() { return KNOWLEDGE }
export function getKnowledge(id) { return KNOWLEDGE.find(k => k.id === id) || null }

/** 오늘의 상식: date 가 그날로 지정된 항목, 없으면 날짜에 따라 돌아가며 하나 */
export function todayKnowledge(date) {
  const fixed = KNOWLEDGE.find(k => k.date === date)
  if (fixed) return fixed
  const [y, m, d] = date.split('-').map(Number)
  const day = Math.floor(Date.UTC(y, m - 1, d) / 864e5)
  return KNOWLEDGE[day % KNOWLEDGE.length]
}
