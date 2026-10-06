// 일본어 12주 모임 자료 → 플랜 템플릿 JSON → DB(gs_plan_templates) 업로드
// 사용: node scripts/plans/import-japanese.mjs "<자료 폴더>" [--dry]
//   자료 폴더: 00_먼저읽기.md, 05_플래시카드.tsv, 06_수업자료.md, 07_시험문항.csv, 08_모임운영_템플릿.md, 11_역할극카드와_말하기평가.md
//   --dry 이면 업로드하지 않고 scripts/plans/out/japanese-12w.json 만 쓴다 (out/ 는 gitignore).
// 자료 원문은 저장소에 넣지 않는다. 업로드에는 .env.local(키) + .env.test.local(GS_ADMIN_CODE) 필요.
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

/* ---------- 개요·자료실 (md 그대로) ---------- */
const sections = md => md.split(/^## /m).slice(1).map(s => { const [t, ...b] = s.split('\n'); return { title: t.trim(), body: b.join('\n').trim() } })
const { days, quickRef } = parseLessons(read('06_수업자료.md'))
const intro = sections(read('00_먼저읽기.md'))
const refs = [
  { title: '빠른 참고표', body: quickRef.replace(/^## /gm, '### ') },
  { title: '역할극 카드와 말하기 평가', body: read('11_역할극카드와_말하기평가.md').replace(/^# .*\n/, '').replace(/^## /gm, '### ') },
  { title: '모임 운영 템플릿', body: read('08_모임운영_템플릿.md').replace(/^# .*\n/, '').replace(/^## /gm, '### ') },
]

const data = {
  version: 1,
  title: '일본어 생초보 12주',
  summary: '평일 30분 모임 + 개인 숙제 15~20분, 12주 60회. 글자 읽기·자기소개·주문·가격/시간·다시 묻기.',
  weeks: 12, days, quiz, cards, intro, refs,
}

// 검증: 60일, 모든 Day 에 시험 문항
const missing = days.filter(d => !quiz[d.day]?.length).map(d => d.day)
console.log(`Day ${days.length}개, 시험 ${Object.values(quiz).flat().length}문항, 카드 ${cards.length}장, 개요 ${intro.length}절, 자료 ${refs.length}개`)
console.log(`단어표 있는 Day ${days.filter(d => d.words.length).length}, 예문 있는 Day ${days.filter(d => d.examples.length).length}, 시험일 ${days.filter(d => d.kind === 'test').length}`)
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
