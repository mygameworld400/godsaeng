import { today, addDays, diff } from './date'

export const rid = () => Math.random().toString(36).slice(2, 9)

export const normDay = (d, date) => ({
  date, checks: d.checks || {}, todos: d.todos || [], mood: d.mood || '', pub: !!d.pub, diary: d.diary || '',
  rTotal: d.rTotal || 0, rDone: d.rDone || 0, tTotal: d.tTotal || 0, tDone: d.tDone || 0,
})

/** 저장용 하루 문서. 지운 루틴의 체크는 버리고 집계값을 같이 넣는다. */
export function buildDay(me, day, diaryText) {
  const ids = me.routines.map(r => r.id), checks = {}
  ids.forEach(i => { if (day.checks[i]) checks[i] = true })
  return {
    date: day.date, checks, todos: day.todos, mood: day.mood || '', pub: !!day.pub,
    diary: day.pub ? diaryText || '' : '',
    rTotal: ids.length, rDone: Object.keys(checks).length,
    tTotal: day.todos.length, tDone: day.todos.filter(t => t.done).length,
  }
}

const mk = (rD, rT, tD, tT) => {
  const tot = rT + tT, done = rD + tD
  return { rD, rT, tD, tT, tot, done, pct: tot ? Math.round(done / tot * 100) : 0 }
}

/** 달성률. live 면 프로필의 현재 루틴 개수를 분모로 다시 센다. */
export function stat(profile, day, live) {
  if (live && profile) {
    const ids = (profile.routines || []).map(r => r.id), c = day?.checks || {}, td = day?.todos || []
    return mk(ids.filter(i => c[i]).length, ids.length, td.filter(t => t.done).length, td.length)
  }
  if (!day) return mk(0, 0, 0, 0)
  return mk(day.rDone || 0, day.rTotal || 0, day.tDone || 0, day.tTotal || 0)
}

export function streak(days, profile) {
  let n = 0, d = today()
  if (stat(profile, days[d], true).done > 0) n = 1
  d = addDays(d, -1)
  while (days[d] && (days[d].rDone || 0) + (days[d].tDone || 0) > 0) { n++; d = addDays(d, -1) }
  return n
}

export const catOf = (p, id) => (p.cats || []).find(c => c.id === id)

export function chStat(c) {
  const t = today(), total = diff(c.start, c.end) + 1, ended = t > c.end, last = ended ? c.end : t
  const elapsed = Math.min(total, Math.max(0, diff(c.start, last) + 1))
  const rows = Object.keys(c.members || {}).filter(k => c.members[k] === 'in').map(id => {
    const ck = c.checks?.[id] || {}
    return { id, n: Object.keys(ck).filter(d => ck[d] && d >= c.start && d <= c.end).length, today: !!ck[t] }
  }).sort((a, b) => b.n - a.n)
  return { total, ended, elapsed, rows, t }
}
