import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { hasServer } from '../lib/supabase'
import { today, addDays } from '../lib/date'
import { rid, normDay, buildDay, privDay } from '../lib/stats'
import * as auth from '../services/authService'
import * as profiles from '../services/profileService'
import * as days from '../services/dayService'
import * as cheers from '../services/cheerService'
import * as bets from '../services/betService'
import * as categories from '../services/categoryService'
import * as events from '../services/eventService'
import * as quests from '../services/questService'

/* 전역 상태는 이 파일 하나에 모은다. 컴포넌트는 Supabase 를 직접 부르지 않는다.
   상태는 ref 하나에 두고 변경 후 bump() 로 다시 그린다 (원본 아티팩트 구조를 그대로 옮김).
   화면은 먼저 바꾸고(낙관적 갱신) 저장은 뒤에서 한다. 저장 실패 시 토스트 + 서버 상태로 다시 불러온다.
   서버 키가 없으면(로컬 dev) 미리보기 모드: 저장 없이 메모리에서만 동작한다. */

const Ctx = createContext(null)
const BUBBLE_KEY = 'godsaeng-bubble'
function readBubble() { try { return localStorage.getItem(BUBBLE_KEY) !== 'closed' } catch { return true } }
/** arr 에서 fromId 항목을 빼서 toId 항목 자리로 옮긴다 (드래그 순서 바꾸기) */
function moveItem(arr, fromId, toId) {
  const from = arr.findIndex(x => x.id === fromId), to = arr.findIndex(x => x.id === toId)
  if (from < 0 || to < 0 || from === to) return false
  const [it] = arr.splice(from, 1)
  arr.splice(to, 0, it)
  return true
}
export const useStore = () => useContext(Ctx)

const initial = () => ({
  ready: false, local: !hasServer, session: null, uid: null, loaded: false,
  me: null, people: {}, days: {}, diary: {}, fday: {}, ch: {}, baseCats: [], catDetails: {}, months: {}, events: {}, quests: [], bubbleOpen: readBubble(),
  date: today(), view: null, vdays: {}, cheers: [], toast: '',
})

export function StoreProvider({ children }) {
  const S = useRef(initial()).current
  const [, setV] = useState(0)
  const bump = () => setV(v => v + 1)
  const timers = useRef({}).current

  const toast = msg => {
    S.toast = msg; bump()
    clearTimeout(timers.__toast)
    timers.__toast = setTimeout(() => { S.toast = ''; bump() }, 3200)
  }
  const onErr = e => {
    console.error(e)
    toast('저장하지 못했어요. 잠시 뒤에 다시 해 주세요.')
    if (S.uid && !S.local) loadAll().catch(() => {})
  }
  /** 같은 key 의 저장은 450ms 디바운스로 하나로 합친다. */
  const later = (key, fn) => {
    if (S.local) return
    clearTimeout(timers[key])
    timers[key] = setTimeout(() => { delete timers[key]; fn().catch(onErr) }, 450)
  }
  const now = fn => { if (!S.local) fn().catch(onErr) }

  async function loadAll() {
    const uid = S.uid, since = addDays(today(), -45)
    const [p, priv, d, di, ch, base, qs] = await Promise.all([
      profiles.listProfiles(), profiles.myPrivate(uid), days.listMyDays(uid, since), days.listDiaries(uid, since), bets.listBets(),
      categories.listBaseCats(), quests.listQuests().catch(() => []),  // 챌린지 테이블(014) 전이면 빈 목록
    ])
    S.people = p
    S.me = p[uid] ? { ...structuredClone(p[uid]), routines: priv?.routines ?? p[uid].routines } : null
    S.catDetails = priv?.catDetails || {}
    S.diaryCover = priv?.diaryCover  // undefined 면 표지 칸(013) 없음 → 저장 안 함
    S.days = d; S.diary = di; S.ch = ch; S.baseCats = base; S.months = {}; S.events = {}; S.quests = qs
    syncBaseCats()
    await loadFriendDays()
    if (S.me && !S.view) await setView(uid)
    S.loaded = true; bump()
  }
  /** 기본 활동에서 추가한 내 활동은 이름·아이콘·색을 관리자가 정한 원본에 맞춘다 (관리자 수정이 모두에게 반영되게). */
  function syncBaseCats() {
    if (!S.me) return
    let changed = false
    for (const c of S.me.cats) {
      const b = c.base && S.baseCats.find(x => x.id === c.base)
      if (!b) continue
      const o = c.opt && b.options.find(x => x.id === c.opt)  // 하위 선택지(예: 언어 → 영어)면 그 이름·아이콘
      const want = { name: o ? o.name : b.name, icon: (o && o.icon) || b.icon, color: b.color }
      if (c.name !== want.name || c.icon !== want.icon || c.color !== want.color) { Object.assign(c, want); changed = true }
    }
    if (changed) saveMe()
  }
  /** 다른 사람·관리자가 바꾼 것만 가볍게 다시 받는다 (내 기록은 수정 중일 수 있어 건드리지 않음). */
  async function softRefresh() {
    if (S.local || !S.uid || !S.loaded) return
    const [p, base, ch, qs] = await Promise.all([profiles.listProfiles(), categories.listBaseCats(), bets.listBets(), quests.listQuests().catch(() => null)])
    if (S.me && p[S.uid]) p[S.uid] = structuredClone(S.me)
    S.people = p; S.baseCats = base; S.ch = ch
    if (qs) {
      // 내 진도는 저장 대기 중일 수 있으니 화면 값 유지
      for (const q of qs) { const old = S.quests.find(x => x.id === q.id)?.members.find(m => m.userId === S.uid); const mine = q.members.find(m => m.userId === S.uid); if (old && mine) mine.progress = old.progress }
      S.quests = qs
    }
    if (S.me && !p[S.uid]) { auth.signOut(); return }  // 관리자가 내 계정을 지운 경우
    syncBaseCats()
    await loadFriendDays()
    bump()
  }
  async function loadFriendDays() {
    if (S.local || !S.me) return
    S.fday = await days.daysOn(S.me.friends.slice(0, 30), today())
  }

  /* ---------- 세션 ---------- */
  useEffect(() => {
    if (S.local) { S.uid = 'me'; S.ready = true; S.loaded = true; bump(); return }
    const apply = async session => {
      S.session = session; S.ready = true
      // 갓생홈피 계정(gs-…@godsaeng.local)만 로그인으로 인정한다
      const ok = session?.user?.email?.endsWith('@godsaeng.local')
      const uid = ok ? session.user.id : null
      if (uid === S.uid) { bump(); return }
      Object.assign(S, { uid, loaded: false, me: null, view: null, people: {}, days: {}, diary: {}, ch: {}, fday: {}, catDetails: {}, months: {}, events: {}, undatedLoaded: false, allDiaries: false, diaryCover: undefined })
      bump()
      if (uid) loadAll().catch(e => { S.loaded = true; onErr(e) })
    }
    auth.getSession().then(apply)
    const sub = auth.onAuth(apply)
    // 창으로 돌아오면 + 1분마다: 관리자 변경(계정·기본 활동·이미지)과 친구 기록을 반영
    const soft = () => { if (document.visibilityState === 'visible') softRefresh().catch(() => {}) }
    document.addEventListener('visibilitychange', soft)
    const iv = setInterval(soft, 60000)
    return () => { sub.unsubscribe(); document.removeEventListener('visibilitychange', soft); clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- 저장 헬퍼 ---------- */
  const saveMe = () => {
    S.people[S.uid] = structuredClone(S.me)
    later('me', () => profiles.saveProfile(S.uid, S.me, S.catDetails, S.diaryCover))
  }
  const myDay = date => S.days[date] || (S.days[date] = normDay({}, date))
  const saveDay = date => {
    const day = myDay(date), built = buildDay(S.me, day, S.diary[date]), priv = structuredClone(privDay(S.me, day))
    later('day:' + date, () => days.saveDay(S.uid, built, priv))
  }

  /* ---------- 뷰 ---------- */
  async function setView(id) {
    S.view = id; S.vdays = {}; S.cheers = []; bump()
    if (S.local) return
    const [vd, cs] = await Promise.all([
      id === S.uid ? Promise.resolve({}) : days.listDays(id, addDays(today(), -14)),
      cheers.listCheers(id),
    ])
    if (S.view !== id) return
    S.vdays = vd; S.cheers = cs; bump()
  }

  const act = {
    signIn: auth.signIn, register: auth.register, signOut: auth.signOut, toast,
    refresh: () => softRefresh().catch(onErr),
    myDay,

    join(nick, emoji) {
      S.me = { id: S.uid, nick, emoji, bio: '', friends: [], routines: [], cats: [] }
      S.people[S.uid] = structuredClone(S.me)
      now(async () => { await profiles.saveProfile(S.uid, S.me); await loadAll() })
      setView(S.uid).catch(onErr)
    },
    saveProfile(patch) { Object.assign(S.me, patch); saveMe(); bump() },

    /* ---------- 활동 ---------- */
    // 기본 활동을 내 활동으로 복사한다. base 로 원본을 기억해 '추가됨' 표시에 쓴다.
    // o: 하위 선택지 (예: 언어 → 영어). 선택지마다 따로 담을 수 있다.
    addBaseCat(b, o) {
      if (S.me.cats.length >= 20) return toast('활동은 20개까지 만들 수 있어요.')
      if (S.me.cats.some(c => c.base === b.id && (c.opt || null) === (o?.id || null))) return
      const id = rid()
      S.me.cats.push({ id, name: o ? o.name : b.name, icon: (o && o.icon) || b.icon, color: b.color, base: b.id, ...(o ? { opt: o.id } : {}) })
      S.catDetails[id] = { start: today(), goal: '', todos: [] }
      saveMe(); bump()
      return id
    },
    addCat(name, icon) {
      if (S.me.cats.length >= 20) return toast('활동은 20개까지 만들 수 있어요.')
      const id = rid()
      S.me.cats.push({ id, name, icon: icon || '🏷️', color: 'c' + (S.me.cats.length % 6 + 1) })
      S.catDetails[id] = { start: today(), goal: '', todos: [] }
      saveMe(); bump()
      return id
    },
    moveCat(fromId, toId) { if (moveItem(S.me.cats, fromId, toId)) { saveMe(); bump() } },
    /** 순서를 한 칸 앞(-1)/뒤(+1)로 */
    shiftCat(id, d) { const i = S.me.cats.findIndex(c => c.id === id), j = i + d; if (i >= 0 && j >= 0 && j < S.me.cats.length) act.moveCat(id, S.me.cats[j].id) },
    updateCat(id, patch) { const c = S.me.cats.find(x => x.id === id); if (c) { Object.assign(c, patch); saveMe(); bump() } },
    delCat(id) { S.me.cats = S.me.cats.filter(c => c.id !== id); delete S.catDetails[id]; saveMe(); bump() },
    catDetail: id => S.catDetails[id] || (S.catDetails[id] = { start: '', goal: '', todos: [] }),
    setCatDetail(id, patch) { Object.assign(act.catDetail(id), patch); saveMe(); bump() },
    editCatTodo(id, tid, text) { const t = act.catDetail(id).todos.find(x => x.id === tid); if (t && text) { t.text = text; saveMe(); bump() } },
    addCatTodo(id, text) { act.catDetail(id).todos.push({ id: rid(), text, done: false }); saveMe(); bump() },
    toggleCatTodo(id, tid) { const t = act.catDetail(id).todos.find(x => x.id === tid); if (t) { t.done = !t.done; saveMe(); bump() } },
    delCatTodo(id, tid) { const d = act.catDetail(id); d.todos = d.todos.filter(x => x.id !== tid); saveMe(); bump() },

    addRoutine(text, cat) { S.me.routines.push({ id: rid(), text, cat, pub: false }); saveMe(); saveDay(today()); bump() },
    editRoutine(id, patch) { const r = S.me.routines.find(x => x.id === id); if (r) { Object.assign(r, patch); saveMe(); saveDay(today()); bump() } },
    moveRoutine(fromId, toId) { if (moveItem(S.me.routines, fromId, toId)) { saveMe(); bump() } },
    togglePubRoutine(id) { const r = S.me.routines.find(x => x.id === id); if (r) { r.pub = !r.pub; saveMe(); saveDay(today()); bump() } },
    delRoutine(id) { S.me.routines = S.me.routines.filter(r => r.id !== id); saveMe(); saveDay(today()); bump() },

    setDate(n) { S.date = n ? addDays(S.date, n) : today(); bump() },
    setDateTo(d) { S.date = d; bump() },
    /** 일정 말풍선 펼치기/접기 (이 브라우저에 기억) */
    setBubble(open) { S.bubbleOpen = open; try { localStorage.setItem(BUBBLE_KEY, open ? 'open' : 'closed') } catch { /* 무시 */ } bump() },
    /** 캘린더에서 보는 달('YYYY-MM')의 내 기록을 불러온다. 이미 있는 날(수정 중일 수 있음)은 덮지 않는다. */
    loadMonth(ym) {
      if (S.local || S.months[ym]) return
      S.months[ym] = true
      const [y, m] = ym.split('-').map(Number), from = ym + '-01', to = ym + '-' + String(new Date(y, m, 0).getDate()).padStart(2, '0')
      const undated = S.undatedLoaded ? Promise.resolve([]) : events.listUndated(S.uid).catch(() => [])
      S.undatedLoaded = true
      Promise.all([days.listMyDays(S.uid, from, to), events.listEvents(S.uid, from, to), undated]).then(([got, evs, und]) => {
        for (const k in got) if (!S.days[k]) S.days[k] = got[k]
        evs.concat(und).forEach(e => { S.events[e.id] = e })
        bump()
      }).catch(e => { delete S.months[ym]; onErr(e) })
    },

    /* ---------- 일정 ---------- */
    // start 가 없으면 날짜 없는 일정
    addEvent(e) {
      const ev = { id: crypto.randomUUID(), color: 'c4', ...e, start: e.start || null, end: e.start ? (e.end && e.end >= e.start ? e.end : e.start) : null }
      S.events[ev.id] = ev; bump()
      now(() => events.addEvent(S.uid, ev))
    },
    updateEvent(id, patch) {
      const ev = S.events[id]; if (!ev) return
      Object.assign(ev, patch)
      if (!ev.start) { ev.start = null; ev.end = null } else if (!ev.end || ev.end < ev.start) ev.end = ev.start
      bump(); now(() => events.updateEvent(id, ev))
    },
    delEvent(id) { delete S.events[id]; bump(); now(() => events.removeEvent(id)) },
    /** 달력 칸에 보이기/숨기기 */
    toggleEventShown(id) { const ev = S.events[id]; if (ev) act.updateEvent(id, { hidden: !ev.hidden }) },
    toggleRoutine(id, on) { const d = myDay(S.date); if (on) d.checks[id] = true; else delete d.checks[id]; saveDay(S.date); bump() },
    addTodo(text, cat) { myDay(S.date).todos.push({ id: rid(), text, cat, done: false, pub: false }); saveDay(S.date); bump() },
    editTodo(id, patch) { const t = myDay(S.date).todos.find(x => x.id === id); if (t) { Object.assign(t, patch); saveDay(S.date); bump() } },
    moveTodo(fromId, toId) { if (moveItem(myDay(S.date).todos, fromId, toId)) { saveDay(S.date); bump() } },
    togglePubTodo(id) { const t = myDay(S.date).todos.find(x => x.id === id); if (t) { t.pub = !t.pub; saveDay(S.date); bump() } },
    toggleTodo(id, on) { const t = myDay(S.date).todos.find(x => x.id === id); if (t) t.done = on; saveDay(S.date); bump() },
    delTodo(id) { const d = myDay(S.date); d.todos = d.todos.filter(t => t.id !== id); saveDay(S.date); bump() },
    setMood(m) { const d = myDay(S.date); d.mood = d.mood === m ? '' : m; saveDay(S.date); bump() },
    setPub(on) { myDay(S.date).pub = on; saveDay(S.date); bump() },
    /* ---------- 챌린지 ---------- */
    /** 참여: 참여자로 등록하고, 연결된 활동(예: 언어 → 일본어)이 없으면 내 활동에 담는다 */
    joinQuest(q) {
      if (q.members.some(m => m.userId === S.uid)) return
      q.members.push({ userId: S.uid, progress: {}, joinedAt: new Date().toISOString() })
      const b = S.baseCats.find(x => x.id === q.baseId), o = b && q.optionId ? b.options.find(x => x.id === q.optionId) : null
      if (b && !S.me.cats.some(c => c.base === b.id && (c.opt || null) === (o?.id || null))) act.addBaseCat(b, o || undefined)
      bump(); now(() => quests.joinQuest(q.id, S.uid))
    },
    leaveQuest(q) { q.members = q.members.filter(m => m.userId !== S.uid); bump(); now(() => quests.leaveQuest(q.id, S.uid)) },
    /** 내 챌린지 진도 저장 (0.45초 모아서) */
    setQuestProgress(q, progress) {
      const m = q.members.find(x => x.userId === S.uid); if (!m) return
      m.progress = progress; bump()
      later('quest:' + q.id, () => quests.saveQuestProgress(q.id, S.uid, progress))
    },
    getTemplate: id => quests.getTemplate(id),

    /* ---------- 다이어리 책 ---------- */
    setDiaryAt(date, text) {
      S.diary[date] = text
      later('diary:' + date, () => days.saveDiary(S.uid, date, text))
      if (myDay(date).pub) saveDay(date)
      bump()
    },
    /** 다이어리 책을 펼칠 때 전체 일기를 불러온다 (평소엔 최근 45일만). 수정 중인 날은 덮지 않는다. */
    async loadAllDiaries() {
      if (S.local || S.allDiaries) return
      const all = await days.listDiaries(S.uid, '1900-01-01')
      for (const k in all) if (!(k in S.diary)) S.diary[k] = all[k]
      S.allDiaries = true; bump()
    },
    setDiaryCover(patch) { S.diaryCover = { ...S.diaryCover, ...patch }; saveMe(); bump() },
    setDiary(text) {
      const date = S.date
      S.diary[date] = text
      later('diary:' + date, () => days.saveDiary(S.uid, date, text))
      if (myDay(date).pub) saveDay(date)
      bump()
    },

    view: id => setView(id).catch(onErr),
    addFriend(id) {
      if (S.me.friends.length >= 30) return toast('친구는 30명까지 추가할 수 있어요.')
      if (S.me.friends.includes(id)) return
      S.me.friends.push(id); saveMe(); bump()
      loadFriendDays().then(bump).catch(() => {})
    },
    delFriend(id) { S.me.friends = S.me.friends.filter(f => f !== id); delete S.fday[id]; saveMe(); bump() },

    addCheer(text) {
      const c = { id: rid(), to: S.view || S.uid, from: S.uid, text, at: new Date().toISOString() }
      S.cheers.unshift(c); bump()
      now(async () => { const saved = await cheers.addCheer(c); Object.assign(c, saved); bump() })
    },
    delCheer(id) { S.cheers = S.cheers.filter(c => c.id !== id); bump(); now(() => cheers.removeCheer(id)) },

    createBet(title, n, penalty, invite) {
      const members = { [S.uid]: 'in' }
      invite.forEach(f => { members[f] = 'invited' })
      const c = { id: crypto.randomUUID(), title, penalty, by: S.uid, start: today(), end: addDays(today(), n - 1), members, checks: {} }
      S.ch[c.id] = c; bump()
      now(() => bets.createBet(c))
    },
    joinBet(id, status) { S.ch[id].members[S.uid] = status; bump(); now(() => bets.setMember(id, status)) },
    checkBet(id) {
      const t = today(), c = S.ch[id], mine = c.checks[S.uid] || (c.checks[S.uid] = {})
      mine[t] = !mine[t]; bump()
      now(() => bets.checkBet(id, t, mine[t]))
    },
    delBet(id) { delete S.ch[id]; bump(); now(() => bets.removeBet(id)) },
  }

  // act 는 S 를 직접 참조하므로 한 번만 만든다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actions = useMemo(() => act, [])
  return <Ctx.Provider value={{ S, act: actions }}>{children}</Ctx.Provider>
}
