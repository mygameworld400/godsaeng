import { today, addDays, diff } from './date.js'

export const rid = () => Math.random().toString(36).slice(2, 9)

export const normDay = (d, date) => ({
  date, checks: d.checks || {}, todos: d.todos || [], mood: d.mood || '', pub: !!d.pub, diary: d.diary || '',
  rTotal: d.rTotal || 0, rDone: d.rDone || 0, tTotal: d.tTotal || 0, tDone: d.tDone || 0,
})

/** 친구에게 공유되는 하루 문서. 공개 항목과 개수만 들어간다 (비공개 항목 이름은 빠짐). */
export function buildDay(me, day, diaryText) {
  const rs = me.routines, checks = {}
  rs.forEach(r => { if (r.pub && day.checks[r.id]) checks[r.id] = true })
  return {
    date: day.date, checks, todos: day.todos.filter(t => t.pub), mood: day.mood || '', pub: !!day.pub,
    diary: day.pub ? diaryText || '' : '',
    rTotal: rs.length, rDone: rs.filter(r => day.checks[r.id]).length,
    tTotal: day.todos.length, tDone: day.todos.filter(t => t.done).length,
  }
}

/** 본인만 보는 전체 체크·투두. 지운 루틴의 체크는 버린다. */
export function privDay(me, day) {
  const checks = {}
  me.routines.forEach(r => { if (day.checks[r.id]) checks[r.id] = true })
  return { checks, todos: day.todos }
}

const mk = (rD, rT, tD, tT) => {
  const tot = rT + tT, done = rD + tD
  return { rD, rT, tD, tT, tot, done, pct: tot ? Math.round(done / tot * 100) : 0 }
}

export const pc = (a, b) => b ? Math.round(a / b * 100) : 0

/** 달성률. live(=내 것)면 전체 루틴·투두로 다시 센다.
    친구 것은 공개 항목만 받으므로 저장된 개수를 쓰고, 기록 없는 날은 rCount 를 분모로. */
export function stat(profile, day, live) {
  if (live && profile) {
    const ids = (profile.routines || []).map(r => r.id), c = day?.checks || {}, td = day?.todos || []
    return mk(ids.filter(i => c[i]).length, ids.length, td.filter(t => t.done).length, td.length)
  }
  if (!day) return mk(0, profile?.rCount || 0, 0, 0)
  return mk(day.rDone || 0, day.rTotal || 0, day.tDone || 0, day.tTotal || 0)
}

export function streak(days, profile, live) {
  let n = 0, d = today()
  if (stat(profile, days[d], live).done > 0) n = 1
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
