/* 지식 글 목록에서 오늘 보여 줄 것 고르기 (글 자체는 services/knowledgeService 가 DB 에서 읽는다) */

/** 아직 날짜가 안 된 글은 숨긴다 (날짜 없는 글은 늘 보임) */
export const visibleKnowledge = (list, date) => list.filter(k => !k.day || k.day <= date)

/** 오늘의 지식: 관리자가 그날로 넣은 글, 없으면 보이는 글 중 날짜에 따라 돌아가며 하나 */
export function todayKnowledge(list, date) {
  const fixed = list.find(k => k.day === date)
  if (fixed) return fixed
  const pool = visibleKnowledge(list, date)
  if (!pool.length) return null
  const [y, m, d] = date.split('-').map(Number)
  return pool[Math.floor(Date.UTC(y, m - 1, d) / 864e5) % pool.length]
}
