// 실제 Supabase 에 붙어 가입 → 루틴/투두/일기 → 친구 → 방명록 → 내기 → 권한 경계 → 탈퇴까지 확인한다.
// 사용:  npm run test:db   (.env.local 의 키 + .env.test.local 의 GS_ENTRY_CODE 필요)
// 테스트 계정은 끝나면 gs_delete_me() 로 지운다.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { buildDay, privDay, normDay } from '../src/lib/stats.js'

const readEnv = f => { try { return Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])) } catch { return {} } }
const env = { ...readEnv('.env.local'), ...readEnv('.env.test.local') }
if (!env.GS_ENTRY_CODE || !env.GS_ADMIN_CODE) { console.error('.env.test.local 에 GS_ENTRY_CODE=입장코드, GS_ADMIN_CODE=관리자코드 를 넣어 주세요.'); process.exit(1) }

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
const A = { h: 'gstesta' + tag, nick: '테스트A', pw: 'pw-' + tag + 'a', sb: client() }
const B = { h: 'gstestb' + tag, nick: '테스트B', pw: 'pw-' + tag + 'b', sb: client() }
const reg = (sb, code, login, pw, nick) => sb.rpc('gs_register', { p_code: code, p_login: login, p_password: pw, p_nick: nick, p_emoji: '🐣' })
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

try {
  console.log('가입')
  const bad = await reg(A.sb, 'wrong-code', A.h, A.pw, A.nick)
  ok(bad.error?.message.includes('bad_code'), '틀린 입장코드는 거절')
  for (const U of [A, B]) {
    const r = await reg(U.sb, env.GS_ENTRY_CODE, U.h, U.pw, U.nick)
    ok(!r.error, `${U.h} 가입 ${r.error?.message || ''}`)
    const s = await U.sb.auth.signInWithPassword({ email: await email(U.h), password: U.pw })
    ok(!!s.data.session, `${U.h} 로그인 ${s.error?.message || ''}`)
    U.id = s.data.user?.id
  }
  const dup = await reg(client(), env.GS_ENTRY_CODE, A.h.toUpperCase(), 'xxxx', '다른사람')
  ok(dup.error?.message.includes('taken'), '같은 아이디(대소문자 무시) 중복 가입 거절')
  const kor = await reg(client(), env.GS_ENTRY_CODE, '한글아이디', 'xxxx', '한글')
  ok(kor.error?.message.includes('bad_id'), '영문이 아닌 아이디 거절')
  const sameNick = await reg(client(), env.GS_ENTRY_CODE, 'gsnick' + tag, 'xxxx', A.nick)
  ok(!sameNick.error, '닉네임은 겹쳐도 가입됨 (아이디와 별개)')
  const extra = await client().auth.signInWithPassword({ email: await email('gsnick' + tag), password: 'xxxx' })
  const extraId = extra.data.user?.id
  const wrongPw = await client().auth.signInWithPassword({ email: await email(A.h), password: 'nope' })
  ok(!!wrongPw.error, '틀린 비밀번호 로그인 거절')

  console.log('프로필 / 하루 기록')
  const pa = await A.sb.from('gs_profiles').select('*').eq('id', A.id).single()
  ok(pa.data?.handle === A.h && pa.data?.nick === A.nick && pa.data?.cats.length === 0, '가입 시 아이디·닉네임 따로 저장, 카테고리는 비어서 시작')
  // 앱과 같은 방식으로 저장: 공개분은 buildDay, 전체는 privDay (src/hooks/useStore.jsx saveMe/saveDay)
  const me = { routines: [{ id: 'r1', text: '공개루틴-스트레칭', cat: '', pub: true }, { id: 'r2', text: '비밀루틴-약먹기', cat: '', pub: false }] }
  const day = normDay({ checks: { r1: true, r2: true }, todos: [
    { id: 't1', text: '공개투두-과제', cat: '', done: true, pub: true },
    { id: 't2', text: '비밀투두-병원', cat: '', done: false, pub: false },
  ], pub: true }, today)
  const pubDay = buildDay(me, day, '공개 일기'), priv = privDay(me, day)
  ok(!(await A.sb.from('gs_profiles').update({ routines: me.routines.filter(r => r.pub), r_count: 2, friends: [B.id] }).eq('id', A.id)).error, 'A 프로필에 공개 루틴만 + B 친구 추가')
  ok(!(await A.sb.from('gs_private').upsert({ user_id: A.id, routines: me.routines })).error, 'A 전체 루틴은 비공개 테이블에')
  const row = { user_id: A.id, date: today, checks: pubDay.checks, todos: pubDay.todos, pub: true, diary: pubDay.diary, r_total: pubDay.rTotal, r_done: pubDay.rDone, t_total: pubDay.tTotal, t_done: pubDay.tDone }
  ok(!(await A.sb.from('gs_days').upsert(row)).error, 'A 오늘 공개 기록 저장')
  ok(!(await A.sb.from('gs_day_private').upsert({ user_id: A.id, date: today, ...priv })).error, 'A 오늘 전체 기록 저장')
  ok(!(await A.sb.from('gs_diaries').upsert({ user_id: A.id, date: today, text: '비밀 원문' })).error, 'A 일기 원문 저장')
  const back = (await A.sb.from('gs_day_private').select('*').eq('user_id', A.id).single()).data
  ok(back?.todos.length === 2 && back?.checks.r2, 'A 는 자기 비공개 항목까지 다시 불러옴')

  console.log('친구가 보는 것')
  const seen = (await B.sb.from('gs_days').select('*').eq('user_id', A.id).eq('date', today)).data?.[0]
  ok(seen?.diary === '공개 일기', 'B 가 A 의 공개 일기를 봄')
  ok(seen?.r_done === 2 && seen?.r_total === 2 && seen?.t_done === 1 && seen?.t_total === 2, 'B 가 보는 달성 개수에는 비공개 항목도 포함 (루틴 2/2, 투두 1/2)')
  const profA = (await B.sb.from('gs_profiles').select('*').eq('id', A.id).single()).data
  const leak = JSON.stringify([seen, profA])
  ok(leak.includes('공개루틴-스트레칭') && leak.includes('공개투두-과제'), 'B 에게 공개 항목 이름은 보임')
  ok(!leak.includes('비밀루틴') && !leak.includes('비밀투두') && !leak.includes('r2'), 'B 에게 비공개 항목 이름·id 는 전달 안 됨')
  ok((await B.sb.from('gs_private').select('*').eq('user_id', A.id)).data?.length === 0, 'B 는 A 의 전체 루틴 테이블을 못 봄')
  ok((await B.sb.from('gs_day_private').select('*').eq('user_id', A.id)).data?.length === 0, 'B 는 A 의 전체 기록 테이블을 못 봄')
  const secret = await B.sb.from('gs_diaries').select('*').eq('user_id', A.id)
  ok(secret.data?.length === 0, 'B 는 A 의 일기 원문을 못 봄')
  const hack = await B.sb.from('gs_days').upsert({ ...row, diary: '해킹' })
  ok(!!hack.error, 'B 는 A 의 기록을 못 고침')
  const hackPriv = await B.sb.from('gs_day_private').upsert({ user_id: A.id, date: today, checks: {}, todos: [] })
  ok(!!hackPriv.error, 'B 는 A 의 비공개 기록을 못 덮어씀')
  const hackP = await B.sb.from('gs_profiles').update({ nick: '해킹' }).eq('id', A.id).select()
  ok(!hackP.data?.length, 'B 는 A 의 프로필을 못 고침')

  console.log('방명록')
  const c = await B.sb.from('gs_cheers').insert({ to_id: A.id, from_id: B.id, text: '화이팅' }).select().single()
  ok(!c.error, 'B 가 A 홈피에 방명록')
  const fake = await B.sb.from('gs_cheers').insert({ to_id: B.id, from_id: A.id, text: '사칭' })
  ok(!!fake.error, 'B 가 A 이름으로는 못 씀')
  ok(!!(await A.sb.from('gs_cheers').insert({ to_id: A.id, from_id: A.id, text: '셀프' })).error, '내 홈피 방명록에는 내가 못 씀')
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

  console.log('관리자')
  const adm = (fn, args) => client().rpc(fn, { p_code: env.GS_ADMIN_CODE, ...args })
  ok((await client().rpc('gs_admin_list', { p_code: 'wrong' })).error?.message.includes('bad_admin'), '틀린 관리자 코드 거절')
  const list = await adm('gs_admin_list', {})
  ok(!list.error && [A.id, B.id].every(id => list.data.some(a => a.id === id)), '관리자 계정 목록에 A·B 가 보임')
  ok(list.data?.find(a => a.id === A.id)?.login === A.h, '목록에 아이디·닉네임 표시')
  const newId = 'gsrenamed' + tag
  ok(!(await adm('gs_admin_update', { p_id: B.id, p_login: newId, p_nick: '바뀐닉', p_password: 'newpass1' })).error, '관리자가 B 의 아이디·닉네임·비밀번호 변경')
  ok(!!(await client().auth.signInWithPassword({ email: await email(B.h), password: B.pw })).error, 'B 예전 아이디로는 로그인 안 됨')
  const relog = await B.sb.auth.signInWithPassword({ email: await email(newId), password: 'newpass1' })
  ok(!!relog.data.session, 'B 새 아이디·새 비밀번호로 로그인')
  ok((await adm('gs_admin_update', { p_id: B.id, p_login: A.h, p_nick: '', p_password: '' })).error?.message.includes('taken'), '이미 있는 아이디로는 변경 불가')
  ok((await B.sb.from('gs_profiles').select('nick').eq('id', B.id).single()).data?.nick === '바뀐닉', '닉네임 변경 반영')
  B.h = newId
  ok((await adm('gs_admin_delete', { p_id: '00000000-0000-0000-0000-000000000000' })).error?.message.includes('not_found'), '없는 계정 삭제는 오류로 알려 줌')
  ok(list.data?.find(a => a.id === A.id)?.other_app === false, '갓생홈피 계정은 다른 앱 계정으로 표시 안 됨')
  if (extraId) {
    ok(!(await adm('gs_admin_delete', { p_id: extraId })).error, '관리자가 계정 삭제')
    ok(!(await adm('gs_admin_list', {})).data?.some(a => a.id === extraId), '삭제한 계정은 목록에서 사라짐')
  }

  console.log('카테고리')
  const base = await A.sb.from('gs_base_cats').select('*')
  ok(!base.error && base.data.length > 0, '멤버는 기본 카테고리 목록을 봄')
  ok((await client().from('gs_base_cats').select('*')).data?.length === 0, '로그인 안 하면 기본 카테고리도 안 보임')
  ok(!!(await A.sb.from('gs_base_cats').insert({ name: '해킹' })).error, '일반 사용자는 기본 카테고리를 직접 못 만듦')
  ok((await A.sb.rpc('gs_admin_base_cat_save', { p_code: 'wrong', p_id: null, p_name: 'x', p_icon: '', p_color: '', p_sort: 0 })).error?.message.includes('bad_admin'), '관리자 코드 없이 기본 카테고리 저장 불가')
  const catName = 'T' + tag
  ok(!(await adm('gs_admin_base_cat_save', { p_id: null, p_name: catName, p_icon: '🧪', p_color: 'c5', p_sort: 99 })).error, '관리자가 기본 카테고리 추가')
  const made = (await adm('gs_admin_base_cats', {})).data?.find(c => c.name === catName)
  ok(made?.icon === '🧪', '관리자 목록에 새 기본 카테고리')
  ok(!(await adm('gs_admin_base_cat_save', { p_id: made?.id, p_name: catName + '2', p_icon: '🎯', p_color: '', p_sort: 98 })).error, '관리자가 기본 카테고리 수정')
  ok((await B.sb.from('gs_base_cats').select('*').eq('id', made?.id).single()).data?.icon === '🎯', '수정 내용이 사용자에게 보임')
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  ok(!(await adm('gs_admin_base_cat_save', { p_id: made?.id, p_name: catName + '2', p_icon: '', p_color: '', p_sort: 98, p_image: png })).error, '관리자가 기본 카테고리 이미지 등록')
  ok((await B.sb.from('gs_base_cats').select('image').eq('id', made?.id).single()).data?.image === png, '사용자에게 이미지가 보임')
  ok(!(await adm('gs_admin_base_cat_save', { p_id: made?.id, p_name: catName + '2', p_icon: '', p_color: '', p_sort: 98 })).error
    && (await B.sb.from('gs_base_cats').select('image').eq('id', made?.id).single()).data?.image === png, '이미지 없이 저장하면 기존 이미지 유지')
  ok(!!(await adm('gs_admin_base_cat_save', { p_id: made?.id, p_name: catName + '2', p_icon: '', p_color: '', p_sort: 98, p_image: 'javascript:alert(1)' })).error, '이미지가 아닌 값은 거절')
  await adm('gs_admin_base_cat_save', { p_id: made?.id, p_name: catName + '2', p_icon: '', p_color: '', p_sort: 98, p_image: '' })
  ok(!(await B.sb.from('gs_base_cats').select('image').eq('id', made?.id).single()).data?.image, '빈 값으로 저장하면 이미지 삭제')
  ok(!(await adm('gs_admin_base_cat_delete', { p_id: made?.id })).error, '관리자가 기본 카테고리 삭제')
  const details = { c1: { start: today, goal: '비밀목표', todos: [{ id: 'x', text: '비밀할일', done: false }] } }
  ok(!(await A.sb.from('gs_private').update({ cat_details: details }).eq('user_id', A.id)).error, 'A 카테고리 세부(시작일·목표·투두) 저장')
  ok((await A.sb.from('gs_private').select('cat_details').eq('user_id', A.id).single()).data?.cat_details?.c1?.goal === '비밀목표', 'A 는 자기 카테고리 세부를 다시 불러옴')
  ok((await B.sb.from('gs_private').select('cat_details').eq('user_id', A.id)).data?.length === 0, 'B 는 A 의 카테고리 목표·투두를 못 봄')

  console.log('일정')
  const evEnd = new Date(Date.parse(today) + 2 * 864e5).toISOString().slice(0, 10)
  const ev = await A.sb.from('gs_events').insert({ user_id: A.id, title: '휴가', start_date: today, end_date: evEnd }).select().single()
  ok(!ev.error, 'A 여러 날 일정 추가 (휴가 3일)')
  ok(!(await A.sb.from('gs_events').insert({ user_id: A.id, title: '치과', start_date: today })).error, 'A 하루 일정 추가 (끝 날짜 없음)')
  ok(!!(await A.sb.from('gs_events').insert({ user_id: A.id, title: '거꾸로', start_date: evEnd, end_date: today })).error, '끝 날짜가 시작보다 빠르면 거절')
  ok((await A.sb.from('gs_events').select('*').eq('user_id', A.id)).data?.length === 2, 'A 는 자기 일정 2개를 봄')
  ok((await B.sb.from('gs_events').select('*').eq('user_id', A.id)).data?.length === 0, 'B 는 A 의 일정을 못 봄')
  ok(!!(await B.sb.from('gs_events').insert({ user_id: A.id, title: '사칭', start_date: today })).error, 'B 는 A 일정에 못 끼워 넣음')
  ok(!(await A.sb.from('gs_events').update({ title: '여름휴가' }).eq('id', ev.data?.id)).error, 'A 일정 수정')
  ok(!(await A.sb.from('gs_events').delete().eq('id', ev.data?.id)).error, 'A 일정 삭제')

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
