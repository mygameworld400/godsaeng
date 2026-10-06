// 일본어 12주 모임 자료 → 플랜 템플릿 JSON → DB(gs_plan_templates) 업로드
// 사용: node scripts/plans/import-japanese.mjs "<자료 폴더>" [--dry]
//   자료 폴더: 00_먼저읽기.md, 05_플래시카드.tsv, 06_수업자료.md, 07_시험문항.csv, 11_역할극카드와_말하기평가.md
//   운영 방식: 월~목 개인 공부(지난 수업 시험 → 복습+오답노트 → 오늘 공부 → 일일 테스트), 금요일 모임
//   시험은 배운 것 전부(원래 문항 + 해당 범위 단어·예문 전부). 짝 연습은 넣지 않는다.
//   --dry 이면 업로드하지 않고 scripts/plans/out/japanese-12w.json 만 쓴다 (out/ 는 gitignore).
// 자료 원문은 저장소에 넣지 않는다.
// 주의: 업로드는 DB 템플릿을 통째로 덮어쓴다. 관리자 화면에서 편집한 내용이 있으면 사라지니, 그때는 바꿀 부분만 고쳐서 저장할 것. 업로드에는 .env.local(키) + .env.test.local(GS_ADMIN_CODE) 필요.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = process.argv[2], dry = process.argv.includes('--dry')
if (!dir) { console.error('자료 폴더 경로를 넣어 주세요.'); process.exit(1) }
const read = f => readFileSync(join(dir, f), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n')

/* ---------- 수업자료 md ---------- */
const WEEKDAY = { 월: 'mon', 화: 'tue', 수: 'wed', 목: 'thu', 금: 'fri' }
const parseTable = lines => lines.filter(l => l.startsWith('|') && !/^\|-/.test(l)).slice(1)
  .map(l => l.split('|').slice(1, -1).map(s => s.trim())).map(([jp, read, mean]) => ({ jp, read, mean }))
const parseExamples = text => text.trim().split(/\n\s*\n/).map(b => b.split('\n').map(s => s.trim()))
  .filter(b => b.length >= 3).map(([jp, read, mean]) => ({ jp, read, mean }))
const field = (body, name) => { const m = body.match(new RegExp('^' + name + ':\\s*(.+)$', 'm')); return m ? m[1].trim() : '' }
const sub = (body, name) => { const m = body.match(new RegExp('^### ' + name + '\\n([\\s\\S]*?)(?=^### |^공통:|$(?![\\s\\S]))', 'm')); return m ? m[1].trim() : '' }

function parseLessons(md) {
  const [lessonsPart, refPart] = md.split(/^# 빠른 참고표\s*$/m)
  const chunks = lessonsPart.split(/^## Day /m).slice(1)
  const days = chunks.map(chunk => {
    const [head, ...rest] = chunk.split('\n'), body = rest.join('\n')
    const m = head.match(/^(\d+)\s*·\s*(\d+)주\s*([월화수목금])\s*·\s*(.+)$/)
    if (!m) throw new Error('Day 제목 형식이 달라요: ' + head)
    const [, day, week, wd, title] = m
    const test = /시험/.test(title) && wd === '금'
    const tableLines = body.split('\n').filter(l => l.startsWith('|'))
    return {
      day: +day, week: +week, weekday: WEEKDAY[wd], weekdayKo: wd, title: title.trim(), kind: test ? 'test' : 'lesson',
      goal: field(body, '목표'), explain: field(body, '오늘의 설명'), flow: field(body, '진행'),
      sounds: field(body, '소리표') ? field(body, '소리표').split(' / ').map(s => s.trim()) : [],
      words: tableLines.length ? parseTable(tableLines) : [],
      examples: parseExamples(sub(body, '예문')),
      practice: sub(body, '7분 짝 연습'),
      homework: sub(body, '오늘 숙제') || field(body, '숙제'),
      speaking: field(body, '주간 말하기'),
      common: field(body, '공통'),
    }
  })
  return { days, quickRef: refPart ? refPart.trim() : '' }
}

/* ---------- 시험문항 csv (정답에 쉼표가 들어갈 수 있어 따옴표 처리) ---------- */
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++ } else if (ch === '"') q = false; else cur += ch }
    else if (ch === '"') q = true
    else if (ch === ',') { row.push(cur); cur = '' }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += ch
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter(r => r.length > 1)
}
const quiz = {}
for (const [id, day, , type, q, a] of parseCsv(read('07_시험문항.csv')).slice(1)) {
  (quiz[+day] ||= []).push({ id, type, q, a })
}

/* ---------- 플래시카드 tsv: 앞면 / 뒷면 / 태그(W01 W12 …) ---------- */
const cards = read('05_플래시카드.tsv').split('\n').filter(Boolean).map(l => l.split('\t'))
  .map(([front, back, tags]) => ({ front, back, weeks: (tags || '').split(/\s+/).filter(Boolean).map(t => +t.replace(/^W/, '')) }))

/* ---------- 개요·자료실 ---------- */
const sections = md => md.split(/^## /m).slice(1).map(s => { const [t, ...b] = s.split('\n'); return { title: t.trim(), body: b.join('\n').trim() } })
const { days: rawDays, quickRef } = parseLessons(read('06_수업자료.md'))
const orig = Object.fromEntries(sections(read('00_먼저읽기.md')).map(x => [x.title, x.body]))
// 진행 방식: 월~목 개인 공부, 금요일만 모임 (2026-10 운영 방식 변경). 진행자 교대·30분 시간표는 쓰지 않는다.
const intro = [
  { title: '진행 방식', body: '스터디이면서 동시에 개인 공부예요. 월~목은 각자 공부하고, 금요일에만 모여서 함께 주간시험을 치고 스터디를 해요.\n12주 60일(학습 48일 + 금요일 모임 12일). 글자 읽기·자기소개·간단한 주문·가격/시간·다시 묻기를 목표로 해요. JLPT 합격이나 원어민과 자유대화를 보장하는 과정은 아니에요.\n시작일은 정하지 않고 실제로 공부한 순서대로 Day를 진행해요. 1~3주는 글자와 발음 중심, 4주 이후 매일 새 단어 약 6~8개예요.' },
  { title: '월~목 개인 공부 순서', body: '① 지난 수업 시험 — 앞 Day 내용 문제를 답을 적고(손글씨도 가능) 정답과 비교해 ○/✕ 를 체크해요.\n② 지난 수업 복습 + 오답노트 — 틀린 문제를 오답노트에 적고, 지난 단어·예문을 가린 뒤 다시 떠올려요.\n③ 오늘 공부 — 설명을 읽고 단어·예문을 🔊 로 들으며 소리 내어 따라 해요.\n④ 일일 테스트 — 오늘 단어·예문으로 바로 확인해요.\n마지막으로 숙제를 하고 공부 완료·숙제 완료를 체크해요. 스톱워치로 그날 공부 시간을 기록해요.' },
  { title: '금요일 모임', body: '출석 → 주간시험 20문제(각자 답을 적고 시간이 끝나면 동시에 공개) → 채점·오답 → 주간 말하기 → 다음 주 확인.\n주간시험 원점수 20점은 10점 만점으로 환산해요. 말하기는 별도 10점이며 주간 총점에 합산하지 않고 성장 확인에 써요.\n단어 문제는 뜻이 통하면 정답, 문장은 정답 예시 외에도 문법과 의미가 맞으면 정답이에요. 실수 하나를 오래 토론하지 않아요.' },
  { title: '개인 숙제 15~20분', body: orig['개인 숙제 15~20분'] },
  { title: '공식 듣기 자료', body: orig['공식 듣기 자료'] },
  { title: '발음과 표기 원칙', body: orig['발음과 표기 원칙'] },
  { title: '밀릴 때의 규칙', body: '금요일 주간시험이 80% 미만이면 다음 주 월요일 공부의 앞 5분을 오답 복습에 써요. 70% 미만이면 다음 주 월요일을 보충일로 쓰고 전체 일정을 하루 늦춰요. 다음 Day 자료가 있어도 무리하게 넘기지 않아요.\n금요일 모임에 빠지면 다음 모임 전에 주간시험을 혼자 풀고 말하기를 20~40초 녹음해서 올려요. 점수 경쟁은 선택이고, 지난주 대비 상승도 함께 봐요.\n문법 질문은 예문 1개와 함께 남기고, 확인되지 않은 설명을 정답으로 고정하지 않아요.' },
  { title: '시험 설계', body: '월~목 ① 지난 수업 시험은 직전 Day 내용을 확인해요. ④ 일일 테스트는 오늘 단어·예문으로 만들어요. 금요일은 그 주 월~목 내용을 섞은 누적 시험이고, 다음 주 월요일은 지난 목요일 핵심을 다시 확인해요. 장기 복습은 플래시카드와 오답노트로 해요. Day 01 시작 점검은 점수에 넣지 않아요.' },
]
const refs = [
  { title: '빠른 참고표', body: quickRef.replace(/^## /gm, '### ') },
  { title: '역할극 카드와 말하기 평가', body: read('11_역할극카드와_말하기평가.md').replace(/^# .*\n/, '').replace(/^## /gm, '### ') },
]

/* ---------- Day → 블록 (PlanViewer v2 형식) ---------- */
let seq = 0
const bid = () => 'b' + (++seq).toString(36)
const dailyTest = (d) => [
  ...d.words.map((w, i) => ({ id: `T${String(d.day).padStart(2, '0')}-w${i + 1}`, type: '단어 뜻', q: `${w.jp}의 뜻을 쓰세요.`, a: w.mean })),
  ...d.examples.map((e, i) => ({ id: `T${String(d.day).padStart(2, '0')}-e${i + 1}`, type: '표현 만들기', q: `일본어로 말하거나 쓰세요: ${e.mean}`, a: e.jp === e.read ? e.jp : `${e.jp} / 읽기: ${e.read}` })),
]
// 시험은 배운 것 전부: 원래 문항 + 해당 범위의 단어·예문 전부 (같은 문제는 하나만)
const fromContent = (src, prefix) => [
  ...src.words.map((w, i) => ({ id: `${prefix}-d${src.day}w${i + 1}`, type: '단어 뜻', q: `${w.jp}의 뜻을 쓰세요.`, a: w.mean })),
  ...src.examples.map((e, i) => ({ id: `${prefix}-d${src.day}e${i + 1}`, type: '표현 만들기', q: `일본어로 말하거나 쓰세요: ${e.mean}`, a: e.jp === e.read ? e.jp : `${e.jp} / 읽기: ${e.read}` })),
]
const norm = q => q.replace(/\s+/g, '').replace(/[.。]/g, '')
const merge = (...lists) => { const seen = new Set(); return lists.flat().filter(q => { const k = norm(q.q); if (seen.has(k)) return false; seen.add(k); return true }) }
const prevLesson = d => rawDays.filter(x => x.day < d.day && x.kind === 'lesson').at(-1)
const weekLessons = d => rawDays.filter(x => x.week === d.week && x.kind === 'lesson')

const days = rawDays.map(d => {
  const prev = d.day > 1 ? prevLesson(d) : null
  const qs = d.kind === 'test'
    ? merge(quiz[d.day] || [], ...weekLessons(d).map(x => fromContent(x, `W${d.week}`)))
    : merge(quiz[d.day] || [], prev ? fromContent(prev, `P${String(d.day).padStart(2, '0')}`) : [])
  const blocks = []
  const add = b => blocks.push({ id: bid(), ...b })
  if (d.kind === 'test') {
    add({ type: 'heading', title: '금요일 모임' })
    add({ type: 'quiz', title: '주간시험', items: qs })
    if (d.speaking) add({ type: 'text', title: '주간 말하기', body: d.speaking })
    add({ type: 'notes', title: '오답노트', body: '주간시험에서 틀린 문제를 적고, 맞는 답과 왜 틀렸는지 같이 적어요.' })
  } else {
    // Day 1 은 시작 점검·복습 없이 오늘 공부부터 (2026-10 사용자 결정)
    const first = d.day === 1, n = k => '①②③④'[first ? k - 3 : k - 1]
    if (!first) {
      add({ type: 'heading', title: '① 지난 수업 시험' })
      add({ type: 'quiz', title: '지난 수업 시험', items: qs })
      add({ type: 'heading', title: '② 지난 수업 복습 + 오답노트' })
      add({ type: 'notes', title: '오답노트', body: '지난 수업 시험에서 틀린 문제를 적고, 맞는 답과 왜 틀렸는지 같이 적어요. 지난 Day 단어·예문을 가리고 다시 떠올려 보세요.' })
    }
    add({ type: 'heading', title: n(3) + ' 오늘 공부' })
    if (d.explain) add({ type: 'text', title: '오늘의 설명', body: d.explain })
    if (d.sounds.length) add({ type: 'sounds', title: '소리표', items: d.sounds })
    if (d.words.length) add({ type: 'words', title: '단어', items: d.words })
    if (d.examples.length) add({ type: 'examples', title: '예문', items: d.examples })
    const dt = dailyTest(d)
    if (dt.length) { add({ type: 'heading', title: n(4) + ' 일일 테스트' }); add({ type: 'quiz', title: '일일 테스트', items: dt }) }
  }
  if (d.homework || d.common) add({ type: 'text', title: '오늘 숙제', body: [d.homework, d.common && '공통: ' + d.common].filter(Boolean).join('\n\n') })
  return { day: d.day, week: d.week, weekdayKo: d.weekdayKo, title: d.title, kind: d.kind, goal: d.goal, blocks }
})

const data = {
  version: 2,
  title: '일본어 생초보 12주',
  summary: '월~목 개인 공부, 금요일 모임(주간시험·스터디). 12주 60일. 글자 읽기·자기소개·주문·가격/시간·다시 묻기.',
  weeks: 12, days, cards, intro, refs,
}

// 검증: 60일, 모든 Day 에 시험 문항
const missing = days.filter(d => !d.blocks.some(b => b.type === 'quiz' && b.items.length)).map(d => d.day)  // Day 1 도 일일 테스트가 있다
console.log(`Day ${days.length}개, 원 시험 ${Object.values(quiz).flat().length}문항, 카드 ${cards.length}장, 개요 ${intro.length}절, 자료 ${refs.length}개`)
console.log(`일일 테스트 ${days.flatMap(d => d.blocks.filter(b => b.title === '일일 테스트')).flatMap(b => b.items).length}문항, 금요일 ${days.filter(d => d.kind === 'test').length}일`)
if (days.length !== 60 || missing.length) { console.error('확인 필요 — 시험 없는 Day:', missing); process.exit(1) }

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'japanese-12w.json'), JSON.stringify(data, null, 1))
console.log(`JSON ${Math.round(JSON.stringify(data).length / 1024)}KB → scripts/plans/out/japanese-12w.json`)
if (dry) process.exit(0)

const { createClient } = await import('@supabase/supabase-js')
const env = f => { try { return Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])) } catch { return {} } }
const E = { ...env('.env.local'), ...env('.env.test.local') }
const sb = createClient(E.VITE_SUPABASE_URL, E.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const r = await sb.rpc('gs_admin_plan_save', { p_code: E.GS_ADMIN_CODE, p_id: 'japanese-12w', p_title: data.title, p_summary: data.summary, p_data: data })
console.log(r.error ? '업로드 실패: ' + r.error.message : '업로드 완료: japanese-12w')
process.exit(r.error ? 1 : 0)
