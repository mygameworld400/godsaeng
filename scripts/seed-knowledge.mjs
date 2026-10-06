/* 예시 지식 글(src/data/knowledge.js)을 DB(gs_knowledge)에 날짜 없는 글로 올린다. 이미 같은 제목이 있으면 건너뛴다.
   실행: node scripts/seed-knowledge.mjs   (.env.local + .env.test.local 의 GS_ADMIN_CODE 사용) */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { KNOWLEDGE } from '../src/data/knowledge.js'

const env = f => Object.fromEntries(readFileSync(f, 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const E = { ...env('.env.local'), ...env('.env.test.local') }
const sb = createClient(E.VITE_SUPABASE_URL, E.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

// 읽기는 멤버 전용이라, 관리자 백업으로 기존 제목을 확인한다
const bk = await sb.rpc('gs_admin_backup', { p_code: E.GS_ADMIN_CODE })
if (bk.error) { console.error(bk.error.message); process.exit(1) }
const have = new Set((bk.data.gs_knowledge || []).map(r => r.title))
let n = 0
for (const k of KNOWLEDGE) {
  if (have.has(k.title)) continue
  const r = await sb.rpc('gs_admin_knowledge_save', { p_code: E.GS_ADMIN_CODE, p_id: null, p_row: {
    day: '', category: k.category, title: k.title, summary: k.summary, body: k.body.join('\n\n'), key_points: k.keyPoints, tags: k.tags, image: '', minutes: k.minutes,
  } })
  if (r.error) { console.error(k.title, r.error.message); process.exit(1) }
  n++
}
console.log(`올림 ${n}개 · 건너뜀 ${KNOWLEDGE.length - n}개`)
