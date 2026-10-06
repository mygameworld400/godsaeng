// 실제 Supabase 에 붙어 가입 → 루틴/투두/일기 → 친구 → 방명록 → 내기 → 권한 경계 → 탈퇴까지 확인한다.
// 사용:  npm run test:db   (.env.local 의 키 + .env.test.local 의 GS_ENTRY_CODE 필요)
// 테스트 계정은 끝나면 gs_delete_me() 로 지운다.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'

const readEnv = f => { try { return Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])) } catch { return {} } }
const env = { ...readEnv('.env.local'), ...readEnv('.env.test.local') }
if (!env.GS_ENTRY_CODE) { console.error('.env.test.local 에 GS_ENTRY_CODE=입장코드 를 넣어 주세요.'); process.exit(1) }

globalThis.crypto ??= webcrypto
// src/services/authService.js 의 loginEmail 과 같은 식 (DB gs_login_email 과도 같아야 함)
const email = async h => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(h.trim().toLowerCase()))
  return 'gs-' + [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32) + '@godsaeng.local'
}

const client = () => createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
let fails = 0
const ok = (cond, label) => { console.log((cond ? '  ✓ ' : '  ✗ ') + label); if (!cond) fails++ }
const tag = Date.now().toString(36).slice(-5)
const A = { h: '테스트A' + tag, pw: 'pw-' + tag + 'a', sb: client() }
const B = { h: '테스트B' + tag, pw: 'pw-' + tag + 'b', sb: client() }
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

try {
  console.log('가입')
  const bad = await A.sb.rpc('gs_register', { p_code: 'wrong-code', p_handle: A.h, p_password: A.pw, p_emoji: '🐣' })
  ok(bad.error?.message.includes('bad_code'), '틀린 입장코드는 거절')
  for (const U of [A, B]) {
    const r = await U.sb.rpc('gs_register', { p_code: env.GS_ENTRY_CODE, p_handle: U.h, p_password: U.pw, p_emoji: '🐣' })
    ok(!r.error, `${U.h} 가입 ${r.error?.message || ''}`)
    const s = await U.sb.auth.signInWithPassword({ email: await email(U.h), password: U.pw })
    ok(!!s.data.session, `${U.h} 로그인 ${s.error?.message || ''}`)
    U.id = s.data.user?.id
  }
  const dup = await client().rpc('gs_register', { p_code: env.GS_ENTRY_CODE, p_handle: A.h.toLowerCase(), p_password: 'xxxx', p_emoji: '' })
  ok(dup.error?.message.includes('taken'), '같은 닉네임 중복 가입 거절')
  const wrongPw = await client().auth.signInWithPassword({ email: await email(A.h), password: 'nope' })
  ok(!!wrongPw.error, '틀린 비밀번호 로그인 거절')

  console.log('프로필 / 하루 기록')
  const pa = await A.sb.from('gs_profiles').select('*').eq('id', A.id).single()
  ok(pa.data?.handle === A.h && pa.data?.cats.length === 3, '가입 시 프로필 + 기본 카테고리 3개 생성')
  const rid = 'r1'
  ok(!(await A.sb.from('gs_profiles').update({ routines: [{ id: rid, text: '스트레칭', cat: '' }], friends: [B.id] }).eq('id', A.id)).error, 'A 루틴 추가 + B 친구 추가')
  const day = { user_id: A.id, date: today, checks: { [rid]: true }, todos: [{ id: 't1', text: '과제', cat: '', done: false }], pub: true, diary: '공개 일기', r_total: 1, r_done: 1, t_total: 1, t_done: 0 }
  ok(!(await A.sb.from('gs_days').upsert(day)).error, 'A 오늘 기록 저장')
  ok(!(await A.sb.from('gs_diaries').upsert({ user_id: A.id, date: today, text: '비밀 원문' })).error, 'A 일기 원문 저장')

  console.log('친구가 보는 것')
  const seen = await B.sb.from('gs_days').select('*').eq('user_id', A.id).eq('date', today)
  ok(seen.data?.[0]?.diary === '공개 일기', 'B 가 A 의 오늘 기록·공개 일기를 봄')
  const secret = await B.sb.from('gs_diaries').select('*').eq('user_id', A.id)
  ok(secret.data?.length === 0, 'B 는 A 의 일기 원문을 못 봄')
  const hack = await B.sb.from('gs_days').upsert({ ...day, diary: '해킹' })
  ok(!!hack.error, 'B 는 A 의 기록을 못 고침')
  const hackP = await B.sb.from('gs_profiles').update({ nick: '해킹' }).eq('id', A.id).select()
  ok(!hackP.data?.length, 'B 는 A 의 프로필을 못 고침')

  console.log('방명록')
  const c = await B.sb.from('gs_cheers').insert({ to_id: A.id, from_id: B.id, text: '화이팅' }).select().single()
  ok(!c.error, 'B 가 A 홈피에 방명록')
  const fake = await B.sb.from('gs_cheers').insert({ to_id: B.id, from_id: A.id, text: '사칭' })
  ok(!!fake.error, 'B 가 A 이름으로는 못 씀')
  ok(!(await A.sb.from('gs_cheers').delete().eq('id', c.data?.id)).error, 'A 가 자기 홈피 방명록 삭제')

  console.log('내기')
  const betId = crypto.randomUUID()
  const end = new Date(Date.parse(today) + 6 * 864e5).toISOString().slice(0, 10)
  ok(!(await A.sb.from('gs_challenges').insert({ id: betId, title: '매일 운동', penalty: '치킨', by_id: A.id, start_date: today, end_date: end, members: { [A.id]: 'in', [B.id]: 'invited' } })).error, 'A 가 B 초대해서 내기 생성')
  ok((await B.sb.from('gs_challenges').select('id').eq('id', betId)).data?.length === 1, 'B 에게 초대받은 내기가 보임')
  const early = await B.sb.rpc('gs_bet_check', { p_id: betId, p_date: today, p_on: true })
  let bet = (await A.sb.from('gs_challenges').select('*').eq('id', betId).single()).data
  ok(!early.error && !bet.checks[B.id], '참가 전에는 인증이 반영 안 됨')
  ok(!(await B.sb.rpc('gs_bet_set_member', { p_id: betId, p_status: 'in' })).error, 'B 참가')
  await A.sb.rpc('gs_bet_check', { p_id: betId, p_date: today, p_on: true })
  await B.sb.rpc('gs_bet_check', { p_id: betId, p_date: today, p_on: true })
  bet = (await A.sb.from('gs_challenges').select('*').eq('id', betId).single()).data
  ok(bet.members[B.id] === 'in' && bet.checks[A.id]?.[today] && bet.checks[B.id]?.[today], '둘 다 오늘 인증 반영')
  const direct = await B.sb.from('gs_challenges').update({ title: '해킹' }).eq('id', betId).select()
  ok(!direct.data?.length, 'B 는 내기 내용을 직접 못 고침')
  const delB = await B.sb.from('gs_challenges').delete().eq('id', betId).select()
  ok(!delB.data?.length, '만든 사람이 아니면 내기 삭제 불가')
  ok(!(await A.sb.from('gs_challenges').delete().eq('id', betId)).error, 'A 가 내기 삭제')

  console.log('외부인')
  const anon = await client().from('gs_days').select('*')
  ok(anon.data?.length === 0, '로그인 안 하면 아무것도 안 보임')
} catch (e) {
  console.error(e); fails++
} finally {
  console.log('정리')
  for (const U of [A, B]) if (U.id) {
    const r = await U.sb.rpc('gs_delete_me')
    ok(!r.error, `${U.h} 탈퇴(테스트 계정 삭제)`)
  }
  const gone = await client().auth.signInWithPassword({ email: await email(A.h), password: A.pw })
  ok(!!gone.error, '탈퇴한 계정은 로그인 안 됨')
}
console.log(fails ? `\n실패 ${fails}개` : '\n모두 통과')
process.exit(fails ? 1 : 0)
