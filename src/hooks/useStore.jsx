import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { hasServer } from '../lib/supabase'
import { today, addDays } from '../lib/date'
import { rid, normDay, buildDay } from '../lib/stats'
import * as auth from '../services/authService'
import * as profiles from '../services/profileService'
import * as days from '../services/dayService'
import * as cheers from '../services/cheerService'
import * as bets from '../services/betService'

/* 전역 상태는 이 파일 하나에 모은다. 컴포넌트는 Supabase 를 직접 부르지 않는다.
   상태는 ref 하나에 두고 변경 후 bump() 로 다시 그린다 (원본 아티팩트 구조를 그대로 옮김).
   화면은 먼저 바꾸고(낙관적 갱신) 저장은 뒤에서 한다. 저장 실패 시 토스트 + 서버 상태로 다시 불러온다.
   서버 키가 없으면(로컬 dev) 미리보기 모드: 저장 없이 메모리에서만 동작한다. */

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const initial = () => ({
  ready: false, local: !hasServer, session: null, uid: null, loaded: false,
  me: null, people: {}, days: {}, diary: {}, fday: {}, ch: {},
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
    const [p, d, di, ch] = await Promise.all([
      profiles.listProfiles(), days.listDays(uid, since), days.listDiaries(uid, since), bets.listBets(),
    ])
    S.people = p; S.me = p[uid] ? structuredClone(p[uid]) : null
    S.days = d; S.diary = di; S.ch = ch
    await loadFriendDays()
    if (S.me && !S.view) await setView(uid)
    S.loaded = true; bump()
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
      const uid = session?.user?.id || null
      if (uid === S.uid) { bump(); return }
      Object.assign(S, { uid, loaded: false, me: null, view: null, people: {}, days: {}, diary: {}, ch: {}, fday: {} })
      bump()
      if (uid) loadAll().catch(e => { S.loaded = true; onErr(e) })
    }
    auth.getSession().then(apply)
    const sub = auth.onAuth(apply)
    return () => sub.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- 저장 헬퍼 ---------- */
  const saveMe = () => {
    S.people[S.uid] = structuredClone(S.me)
    later('me', () => profiles.saveProfile(S.uid, S.me))
  }
  const myDay = date => S.days[date] || (S.days[date] = normDay({}, date))
  const saveDay = date => {
    const built = buildDay(S.me, myDay(date), S.diary[date])
    later('day:' + date, () => days.saveDay(S.uid, built))
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
    signIn: auth.signIn, signUp: auth.signUp, signOut: auth.signOut, toast,
    refresh: () => { if (!S.local && S.uid) loadAll().catch(onErr) },
    myDay,

    join(nick, emoji) {
      S.me = { id: S.uid, nick, emoji, bio: '', friends: [], routines: [],
        cats: [{ id: rid(), name: '운동', color: 'c3' }, { id: rid(), name: '공부', color: 'c4' }, { id: rid(), name: '생활', color: 'c2' }] }
      S.people[S.uid] = structuredClone(S.me)
      now(async () => { await profiles.saveProfile(S.uid, S.me); await loadAll() })
      setView(S.uid).catch(onErr)
    },
    saveProfile(patch) { Object.assign(S.me, patch); saveMe(); bump() },

    addCat(name) {
      if (S.me.cats.length >= 12) return toast('카테고리는 12개까지 만들 수 있어요.')
      S.me.cats.push({ id: rid(), name, color: 'c' + (S.me.cats.length % 6 + 1) }); saveMe(); bump()
    },
    delCat(id) { S.me.cats = S.me.cats.filter(c => c.id !== id); saveMe(); bump() },
    addRoutine(text, cat) { S.me.routines.push({ id: rid(), text, cat }); saveMe(); saveDay(today()); bump() },
    delRoutine(id) { S.me.routines = S.me.routines.filter(r => r.id !== id); saveMe(); saveDay(today()); bump() },

    setDate(n) { S.date = n ? addDays(S.date, n) : today(); bump() },
    toggleRoutine(id, on) { const d = myDay(S.date); if (on) d.checks[id] = true; else delete d.checks[id]; saveDay(S.date); bump() },
    addTodo(text, cat) { myDay(S.date).todos.push({ id: rid(), text, cat, done: false }); saveDay(S.date); bump() },
    toggleTodo(id, on) { const t = myDay(S.date).todos.find(x => x.id === id); if (t) t.done = on; saveDay(S.date); bump() },
    delTodo(id) { const d = myDay(S.date); d.todos = d.todos.filter(t => t.id !== id); saveDay(S.date); bump() },
    setMood(m) { const d = myDay(S.date); d.mood = d.mood === m ? '' : m; saveDay(S.date); bump() },
    setPub(on) { myDay(S.date).pub = on; saveDay(S.date); bump() },
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
