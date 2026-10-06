export const WD = '일월화수목금토'

export const ymd = d =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
export const toD = s => { const [a, b, c] = s.split('-').map(Number); return new Date(a, b - 1, c) }
export const addDays = (s, n) => { const d = toD(s); d.setDate(d.getDate() + n); return ymd(d) }
export const diff = (a, b) => Math.round((toD(b) - toD(a)) / 864e5)
export const today = () => ymd(new Date())
export const pretty = s => s.replace(/-/g, '.') + ' (' + WD[toD(s).getDay()] + ')'

/* DB 시각(timestamptz)은 UTC 로 온다. 화면에는 브라우저 시간대(한국이면 KST)로 바꿔 보여 준다. */
const pad = n => String(n).padStart(2, '0')
export const localDate = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}` }
export const localDateTime = iso => iso ? `${localDate(iso)} ${pad(new Date(iso).getHours())}:${pad(new Date(iso).getMinutes())}` : ''
